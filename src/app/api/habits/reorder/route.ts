import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bumpLastChanged } from "@/lib/sync";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" };

// POST /api/habits/reorder — persist a new habit order for a month.
// Body: { orderedIds: string[] } — habit ids in their new display order.
//
// The order is always renumbered to a gapless 1..n. Any habits of the month
// the client didn't mention are appended at the end (keeping their relative
// order) so the month's order list can never end up with gaps or duplicates.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const ids: unknown = body?.orderedIds;
  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    !ids.every((x) => typeof x === "string")
  ) {
    return NextResponse.json(
      { error: "orderedIds (string[]) required" },
      { status: 400, headers: NO_STORE },
    );
  }
  const orderedIds = ids as string[];
  if (new Set(orderedIds).size !== orderedIds.length) {
    return NextResponse.json(
      { error: "orderedIds must not contain duplicates" },
      { status: 400, headers: NO_STORE },
    );
  }

  const habits = await db.habit.findMany({ where: { id: { in: orderedIds } } });
  if (habits.length !== orderedIds.length) {
    return NextResponse.json(
      { error: "Unknown habit id in orderedIds" },
      { status: 404, headers: NO_STORE },
    );
  }
  const monthId = habits[0]?.monthId;
  if (!monthId || new Set(habits.map((h) => h.monthId)).size !== 1) {
    return NextResponse.json(
      { error: "All habits must belong to the same month" },
      { status: 400, headers: NO_STORE },
    );
  }

  // Append any unmentioned habits of this month at the end.
  const all = await db.habit.findMany({
    where: { monthId },
    orderBy: { order: "asc" },
  });
  const mentioned = new Set(orderedIds);
  const finalIds = [
    ...orderedIds,
    ...all.filter((h) => !mentioned.has(h.id)).map((h) => h.id),
  ];

  // Renumber 1..n inside one transaction. The (monthId, order) unique index
  // was removed, so sequential updates cannot hit transient collisions.
  await db.$transaction(
    finalIds.map((id, i) =>
      db.habit.update({ where: { id }, data: { order: i + 1 } }),
    ),
  );

  const lastChangedAt = await bumpLastChanged();
  return NextResponse.json({ ok: true, order: finalIds, lastChangedAt }, { headers: NO_STORE });
}
