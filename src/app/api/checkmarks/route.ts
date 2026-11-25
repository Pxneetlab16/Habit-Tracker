import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bumpLastChanged } from "@/lib/sync";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" };

// POST /api/checkmarks — set a checkmark (upsert)
// Body: { habitId, day, done }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const habitId: string = String(body.habitId || "");
  const day: number = Number(body.day);
  const done: boolean = Boolean(body.done);
  if (!habitId || !day || day < 1 || day > 31) {
    return NextResponse.json(
      { error: "habitId and day (1-31) required" },
      { status: 400, headers: NO_STORE },
    );
  }

  const updated = await db.checkmark.upsert({
    where: { habitId_day: { habitId, day } },
    update: { done },
    create: { habitId, day, done },
  });
  const lastChangedAt = await bumpLastChanged();
  return NextResponse.json(
    {
      id: updated.id,
      habitId: updated.habitId,
      day: updated.day,
      done: updated.done,
      lastChangedAt,
    },
    { headers: NO_STORE },
  );
}
