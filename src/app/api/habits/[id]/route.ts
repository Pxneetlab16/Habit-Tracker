import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bumpLastChanged } from "@/lib/sync";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" };

// PATCH /api/habits/[id] — update habit (name, category, goal)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const data: { name?: string; category?: string; goal?: number } = {};
  if (typeof body.name === "string") data.name = body.name;
  if (typeof body.category === "string") data.category = body.category;
  if (typeof body.goal === "number") data.goal = body.goal;

  const updated = await db.habit.update({ where: { id }, data });
  const lastChangedAt = await bumpLastChanged();
  return NextResponse.json(
    {
      id: updated.id,
      name: updated.name,
      category: updated.category,
      goal: updated.goal,
      order: updated.order,
      lastChangedAt,
    },
    { headers: NO_STORE },
  );
}

// DELETE /api/habits/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await db.habit.delete({ where: { id } });
  } catch {
    // Already deleted / never existed — treat as idempotent success.
    return NextResponse.json({ ok: true, alreadyDeleted: true }, { headers: NO_STORE });
  }
  const lastChangedAt = await bumpLastChanged();
  return NextResponse.json({ ok: true, lastChangedAt }, { headers: NO_STORE });
}
