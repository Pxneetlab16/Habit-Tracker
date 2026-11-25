import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bumpLastChanged } from "@/lib/sync";

const daysInMonth = (m: number, y: number) => new Date(y, m, 0).getDate();

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" };

// GET /api/months — list all months (newest year/month first)
export async function GET() {
  const months = await db.month.findMany({
    orderBy: [{ year: "desc" }, { month: "desc" }],
    include: { _count: { select: { habits: true, meals: true } } },
  });
  return NextResponse.json(
    months.map((m) => ({
      id: m.id,
      month: m.month,
      year: m.year,
      title: m.title,
      habitCount: m._count.habits,
      mealCount: m._count.meals,
      createdAt: m.createdAt,
    })),
    { headers: NO_STORE },
  );
}

// POST /api/months — create a new month (and optionally clone habits from a source month)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const month: number = Number(body.month);
  const year: number = Number(body.year);
  if (!month || !year || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid month/year" }, { status: 400, headers: NO_STORE });
  }

  const existing = await db.month.findUnique({
    where: { month_year: { month, year } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Month already exists", id: existing.id },
      { status: 409, headers: NO_STORE },
    );
  }

  // Optionally clone habits AND meals from a source month.
  // Goals are month-wise: each cloned habit/meal gets the NEW month's day
  // count (e.g. cloning into November → 30), never the old fixed weekly 7.
  const cloneFromId: string | undefined = body.cloneFromId;
  const newMonthDays = daysInMonth(month, year);
  let sourceHabits: { name: string; category: string; goal: number }[] = [];
  let sourceMeals: { name: string; category: string; goal: number }[] = [];
  if (cloneFromId) {
    const src = await db.habit.findMany({
      where: { monthId: cloneFromId },
      orderBy: { order: "asc" },
    });
    sourceHabits = src.map((h) => ({
      name: h.name,
      category: h.category,
      goal: newMonthDays,
    }));
    const srcMeals = await db.meal.findMany({
      where: { monthId: cloneFromId },
      orderBy: { order: "asc" },
    });
    sourceMeals = srcMeals.map((m) => ({
      name: m.name,
      category: m.category,
      goal: newMonthDays,
    }));
  }

  const created = await db.month.create({
    data: {
      month,
      year,
      title: typeof body.title === "string" ? body.title : null,
      habits:
        sourceHabits.length > 0
          ? { create: sourceHabits.map((h, i) => ({ ...h, order: i + 1 })) }
          : undefined,
      meals:
        sourceMeals.length > 0
          ? { create: sourceMeals.map((m, i) => ({ ...m, order: i + 1 })) }
          : undefined,
    },
    include: { habits: true, meals: true },
  });

  const lastChangedAt = await bumpLastChanged();
  return NextResponse.json(
    {
      id: created.id,
      month: created.month,
      year: created.year,
      title: created.title,
      habits: created.habits,
      meals: created.meals.map((m) => ({
        id: m.id,
        name: m.name,
        category: m.category,
        order: m.order,
        goal: m.goal,
        checks: [],
      })),
      lastChangedAt,
    },
    { headers: NO_STORE },
  );
}
