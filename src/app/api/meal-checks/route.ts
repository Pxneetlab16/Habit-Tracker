import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bumpLastChanged } from "@/lib/sync";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" };

// POST /api/meal-checks — set a meal tick (upsert). Mirrors /api/checkmarks.
// Body: { mealId, day, done }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const mealId: string = String(body.mealId || "");
  const day: number = Number(body.day);
  const done: boolean = Boolean(body.done);
  if (!mealId || !day || day < 1 || day > 31) {
    return NextResponse.json(
      { error: "mealId and day (1-31) required" },
      { status: 400, headers: NO_STORE },
    );
  }

  const updated = await db.mealCheck.upsert({
    where: { mealId_day: { mealId, day } },
    update: { done },
    create: { mealId, day, done },
  });
  const lastChangedAt = await bumpLastChanged();
  return NextResponse.json(
    {
      id: updated.id,
      mealId: updated.mealId,
      day: updated.day,
      done: updated.done,
      lastChangedAt,
    },
    { headers: NO_STORE },
  );
}
