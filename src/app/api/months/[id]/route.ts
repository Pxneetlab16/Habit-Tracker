import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bumpLastChanged } from "@/lib/sync";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" };

// GET /api/months/[id] — full month with habits, meals and their checkmarks
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const month = await db.month.findUnique({
    where: { id },
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
  if (!month) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });

  return NextResponse.json(
    {
      id: month.id,
      month: month.month,
      year: month.year,
      title: month.title,
      habits: month.habits.map((h) => ({
        id: h.id,
        name: h.name,
        category: h.category,
        order: h.order,
        goal: h.goal,
        checkmarks: h.checkmarks.map((c) => ({ day: c.day, done: c.done })),
      })),
      meals: month.meals.map((m) => ({
        id: m.id,
        name: m.name,
        category: m.category,
        order: m.order,
        goal: m.goal,
        checks: m.checks.map((c) => ({ day: c.day, done: c.done })),
      })),
    },
    { headers: NO_STORE },
  );
}

// PATCH /api/months/[id] — update title
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const data: { title?: string | null } = {};
  if ("title" in body) data.title = typeof body.title === "string" ? body.title : null;
  const updated = await db.month.update({ where: { id }, data });
  const lastChangedAt = await bumpLastChanged();
  return NextResponse.json(
    {
      id: updated.id,
      month: updated.month,
      year: updated.year,
      title: updated.title,
      lastChangedAt,
    },
    { headers: NO_STORE },
  );
}

// DELETE /api/months/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await db.month.delete({ where: { id } });
  const lastChangedAt = await bumpLastChanged();
  return NextResponse.json({ ok: true, lastChangedAt }, { headers: NO_STORE });
}
