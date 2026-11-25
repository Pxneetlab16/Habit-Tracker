import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSettings, getLastChanged } from "@/lib/sync";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" };

// GET /api/bootstrap — the complete app state in ONE request:
// settings + lastChangedAt (the data version clock) + every month with its
// habits and checkmarks.
//
// The client uses this for its startup reconcile: it compares lastChangedAt
// with the timestamp stored in its device backup (localStorage) and, if the
// server DB turns out to be older (rolled back), restores the backup.
export async function GET() {
  const settings = await ensureSettings();

  const months = await db.month.findMany({
    orderBy: [{ year: "desc" }, { month: "desc" }],
    include: {
      habits: {
        orderBy: { order: "asc" },
        include: { checkmarks: true },
      },
      meals: {
        orderBy: { order: "asc" },
        include: { checks: true },
      },
    },
  });

  return NextResponse.json(
    {
      settings: {
        id: settings.id,
        name: settings.name,
        theme: settings.theme,
        ignoreDays: JSON.parse(settings.ignoreDays || "[]"),
      },
      lastChangedAt: await getLastChanged(),
      months: months.map((m) => ({
        id: m.id,
        month: m.month,
        year: m.year,
        title: m.title,
        createdAt: m.createdAt,
        habits: m.habits.map((h) => ({
          id: h.id,
          name: h.name,
          category: h.category,
          order: h.order,
          goal: h.goal,
          checkmarks: h.checkmarks.map((c) => ({ day: c.day, done: c.done })),
        })),
        meals: m.meals.map((ml) => ({
          id: ml.id,
          name: ml.name,
          category: ml.category,
          order: ml.order,
          goal: ml.goal,
          checks: ml.checks.map((c) => ({ day: c.day, done: c.done })),
        })),
      })),
    },
    { headers: NO_STORE },
  );
}
