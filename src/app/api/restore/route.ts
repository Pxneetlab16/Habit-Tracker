import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bumpLastChanged, ensureSettings } from "@/lib/sync";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" };

// ---------------------------------------------------------------------------
// POST /api/restore — replace the entire server state with the client's
// device backup (localStorage mirror).
//
// This is the self-healing path: when the server DB has been rolled back
// (crash, workspace restore, DB file replaced), the client detects that its
// backup is NEWER than the server's lastChangedAt clock and pushes the full
// snapshot here. Everything is rebuilt inside one transaction, preserving
// the original month/habit ids whenever they look valid.
// ---------------------------------------------------------------------------

const ID_RE = /^[A-Za-z0-9_-]{8,40}$/;

function str(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim() ? v : fallback;
}

function cleanId(v: unknown): string | undefined {
  return typeof v === "string" && ID_RE.test(v) ? v : undefined;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: NO_STORE });
  }

  const root = (body ?? {}) as Record<string, unknown>;

  // --- Settings -------------------------------------------------------------
  const rawSettings = (root.settings ?? {}) as Record<string, unknown>;
  const name = str(rawSettings.name, "Habit Tracker").slice(0, 60);
  const theme = rawSettings.theme === "dark" ? "dark" : "light";
  const ignoreDays = Array.isArray(rawSettings.ignoreDays)
    ? rawSettings.ignoreDays.filter((d): d is string => typeof d === "string").slice(0, 7)
    : [];

  // --- Months / habits / meals / checkmarks ----------------------------------
  interface MonthIn {
    id?: string;
    month: number;
    year: number;
    title: string | null;
    habits: {
      id?: string;
      name: string;
      category: string;
      order: number;
      goal: number;
      checkmarks: { day: number; done: boolean }[];
    }[];
    meals: {
      id?: string;
      name: string;
      category: string;
      order: number;
      goal: number;
      checks: { day: number; done: boolean }[];
    }[];
  }
  const monthsIn: MonthIn[] = [];
  if (Array.isArray(root.months)) {
    const seenPairs = new Set<string>();
    for (const raw of root.months) {
      const m = (raw ?? {}) as Record<string, unknown>;
      const month = Math.round(Number(m.month));
      const year = Math.round(Number(m.year));
      if (!Number.isFinite(month) || month < 1 || month > 12) continue;
      if (!Number.isFinite(year) || year < 1900 || year > 2200) continue;
      const pair = `${month}-${year}`;
      if (seenPairs.has(pair)) continue; // dedupe (month, year) is unique in DB
      seenPairs.add(pair);

      const habits: MonthIn["habits"] = [];
      if (Array.isArray(m.habits)) {
        let orderSeed = 0;
        for (const rawH of m.habits) {
          const h = (rawH ?? {}) as Record<string, unknown>;
          const hName = str(h.name, "").slice(0, 80);
          const hCat = str(h.category, "General").slice(0, 60);
          if (!hName) continue;
          orderSeed += 1;
          const order = Number.isFinite(Number(h.order)) && Number(h.order) >= 1
            ? Math.round(Number(h.order))
            : orderSeed;
          const goalNum = Math.round(Number(h.goal));
          const goal = Number.isFinite(goalNum) ? Math.min(31, Math.max(1, goalNum)) : 31;

          // Dedupe checkmarks per habit by day (unique [habitId, day] in DB).
          const byDay = new Map<number, boolean>();
          if (Array.isArray(h.checkmarks)) {
            for (const rawC of h.checkmarks) {
              const c = (rawC ?? {}) as Record<string, unknown>;
              const day = Math.round(Number(c.day));
              if (!Number.isFinite(day) || day < 1 || day > 31) continue;
              byDay.set(day, Boolean(c.done));
            }
          }
          const checkmarks = [...byDay.entries()].map(([day, done]) => ({ day, done }));

          habits.push({
            id: cleanId(h.id),
            name: hName,
            category: hCat,
            order,
            goal,
            checkmarks,
          });
        }
      }

      // Meals (diet table) — parsed exactly like habits, tolerant of old
      // backups that predate the diet feature (no meals → empty list).
      const mealsIn: MonthIn["meals"] = [];
      if (Array.isArray(m.meals)) {
        let orderSeed = 0;
        for (const rawM of m.meals) {
          const ml = (rawM ?? {}) as Record<string, unknown>;
          const mName = str(ml.name, "").slice(0, 80);
          const mCat = str(ml.category, "🍽️ Meal").slice(0, 60);
          if (!mName) continue;
          orderSeed += 1;
          const order = Number.isFinite(Number(ml.order)) && Number(ml.order) >= 1
            ? Math.round(Number(ml.order))
            : orderSeed;
          const goalNum = Math.round(Number(ml.goal));
          const goal = Number.isFinite(goalNum) ? Math.min(31, Math.max(1, goalNum)) : 31;

          // Dedupe checks per meal by day (unique [mealId, day] in DB).
          const byDay = new Map<number, boolean>();
          if (Array.isArray(ml.checks)) {
            for (const rawC of ml.checks) {
              const c = (rawC ?? {}) as Record<string, unknown>;
              const day = Math.round(Number(c.day));
              if (!Number.isFinite(day) || day < 1 || day > 31) continue;
              byDay.set(day, Boolean(c.done));
            }
          }
          const checks = [...byDay.entries()].map(([day, done]) => ({ day, done }));

          mealsIn.push({
            id: cleanId(ml.id),
            name: mName,
            category: mCat,
            order,
            goal,
            checks,
          });
        }
      }

      monthsIn.push({
        id: cleanId(m.id),
        month,
        year,
        title: typeof m.title === "string" && m.title ? m.title.slice(0, 60) : null,
        habits,
        meals: mealsIn,
      });
    }
  }

  // Renumber habits & meals gapless 1..n inside each month (defensive).
  for (const m of monthsIn) {
    m.habits.sort((a, b) => a.order - b.order);
    m.habits.forEach((h, i) => {
      h.order = i + 1;
    });
    m.meals.sort((a, b) => a.order - b.order);
    m.meals.forEach((ml, i) => {
      ml.order = i + 1;
    });
  }

  try {
    await db.$transaction(async (tx) => {
      // 1) Settings upsert with restored values + bumped clock.
      await ensureSettings();
      await tx.settings.update({
        where: { id: "default" },
        data: { name, theme, ignoreDays: JSON.stringify(ignoreDays), lastChangedAt: new Date() },
      });

      // 2) Wipe current months (cascades habits + checkmarks + meals).
      await tx.month.deleteMany({});

      // 3) Recreate everything from the backup, preserving ids when valid.
      for (const m of monthsIn) {
        await tx.month.create({
          data: {
            ...(m.id ? { id: m.id } : {}),
            month: m.month,
            year: m.year,
            title: m.title,
            habits: {
              create: m.habits.map((h) => ({
                ...(h.id ? { id: h.id } : {}),
                name: h.name,
                category: h.category,
                order: h.order,
                goal: h.goal,
                checkmarks: {
                  create: h.checkmarks.map((c) => ({ day: c.day, done: c.done })),
                },
              })),
            },
            meals: {
              create: m.meals.map((ml) => ({
                ...(ml.id ? { id: ml.id } : {}),
                name: ml.name,
                category: ml.category,
                order: ml.order,
                goal: ml.goal,
                checks: {
                  create: ml.checks.map((c) => ({ day: c.day, done: c.done })),
                },
              })),
            },
          },
        });
      }
    });
  } catch (e) {
    console.error("Restore failed", e);
    return NextResponse.json(
      { error: "Restore failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 500, headers: NO_STORE },
    );
  }

  const lastChangedAt = await bumpLastChanged();
  return NextResponse.json(
    { ok: true, lastChangedAt, months: monthsIn.length },
    { headers: NO_STORE },
  );
}
