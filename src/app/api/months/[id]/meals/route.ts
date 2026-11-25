import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bumpLastChanged } from "@/lib/sync";

const daysInMonth = (m: number, y: number) => new Date(y, m, 0).getDate();

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" };

// POST /api/months/[id]/meals — add a meal to a month (diet table).
// Mirrors POST /api/months/[id]/habits exactly.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const name: string = String(body.name || "").trim();
  const category: string = String(body.category || "").trim();
  if (!name || !category) {
    return NextResponse.json(
      { error: "name and category are required" },
      { status: 400, headers: NO_STORE },
    );
  }

  // Goal is month-wise (full month days), same rule as habits.
  // If the client didn't send a valid goal, default to this month's day count.
  const month = await db.month.findUnique({ where: { id } });
  let goal = Number(body.goal);
  if (!Number.isFinite(goal) || goal < 1) {
    goal = month ? daysInMonth(month.month, month.year) : 30;
  }
  goal = Math.min(31, Math.max(1, Math.round(goal)));

  // Append at the very end: one past the current maximum order.
  const agg = await db.meal.aggregate({ where: { monthId: id }, _max: { order: true } });
  const nextOrder = (agg._max.order ?? 0) + 1;
  const created = await db.meal.create({
    data: { monthId: id, name, category, goal, order: nextOrder },
  });
  const lastChangedAt = await bumpLastChanged();
  return NextResponse.json(
    {
      id: created.id,
      name: created.name,
      category: created.category,
      order: created.order,
      goal: created.goal,
      checks: [],
      lastChangedAt,
    },
    { headers: NO_STORE },
  );
}
