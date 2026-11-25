import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bumpLastChanged } from "@/lib/sync";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" };

// POST /api/meals/reorder — persist a new meal order for a month.
// Body: { orderedIds: string[] } — meal ids in their new display order.
// Mirrors /api/habits/reorder exactly (same gapless 1..n renumbering).
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

  const meals = await db.meal.findMany({ where: { id: { in: orderedIds } } });
  if (meals.length !== orderedIds.length) {
    return NextResponse.json(
      { error: "Unknown meal id in orderedIds" },
      { status: 404, headers: NO_STORE },
    );
  }
  const monthId = meals[0]?.monthId;
  if (!monthId || new Set(meals.map((m) => m.monthId)).size !== 1) {
    return NextResponse.json(
      { error: "All meals must belong to the same month" },
      { status: 400, headers: NO_STORE },
    );
  }

  // Append any unmentioned meals of this month at the end.
  const all = await db.meal.findMany({
    where: { monthId },
    orderBy: { order: "asc" },
  });
  const mentioned = new Set(orderedIds);
  const finalIds = [
    ...orderedIds,
    ...all.filter((m) => !mentioned.has(m.id)).map((m) => m.id),
  ];

  // Renumber 1..n inside one transaction.
  await db.$transaction(
    finalIds.map((id, i) =>
      db.meal.update({ where: { id }, data: { order: i + 1 } }),
    ),
  );

  const lastChangedAt = await bumpLastChanged();
  return NextResponse.json({ ok: true, order: finalIds, lastChangedAt }, { headers: NO_STORE });
}
