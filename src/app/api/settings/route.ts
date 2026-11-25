import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Every settings response must be uncached — a cached GET here is what made
// saved themes / ignored weekdays appear to "randomly not stick".
const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" };

// GET /api/settings
export async function GET() {
  let s = await db.settings.findUnique({ where: { id: "default" } });
  if (!s) {
    s = await db.settings.create({
      data: { id: "default", name: "Habit Tracker", theme: "light", ignoreDays: "[]" },
    });
  }
  return NextResponse.json({
    id: s.id,
    name: s.name,
    theme: s.theme,
    ignoreDays: JSON.parse(s.ignoreDays || "[]"),
  }, { headers: NO_STORE });
}

// PATCH /api/settings
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const data: { name?: string; theme?: string; ignoreDays?: string } = {};
  if (typeof body.name === "string") data.name = body.name;
  if (typeof body.theme === "string") data.theme = body.theme;
  if (Array.isArray(body.ignoreDays)) data.ignoreDays = JSON.stringify(body.ignoreDays);

  let s = await db.settings.findUnique({ where: { id: "default" } });
  if (!s) {
    s = await db.settings.create({
      data: { id: "default", name: "Habit Tracker", theme: "light", ignoreDays: "[]" },
    });
  }
  // Any settings change also bumps the global data version clock so the
  // client's device-backup reconcile can detect rollbacks.
  const updated = await db.settings.update({
    where: { id: "default" },
    data: { ...data, lastChangedAt: new Date() },
  });
  return NextResponse.json(
    {
      id: updated.id,
      name: updated.name,
      theme: updated.theme,
      ignoreDays: JSON.parse(updated.ignoreDays || "[]"),
      lastChangedAt: updated.lastChangedAt,
    },
    { headers: NO_STORE },
  );
}
