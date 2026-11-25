import { db } from "./db";

// ---------------------------------------------------------------------------
// Global data version clock ("lastChangedAt").
//
// Every mutating API route calls bumpLastChanged() after a successful write.
// The client stores the returned/observed lastChangedAt inside its device
// backup (localStorage). On the next app open the client compares:
//
//   backup.serverChangedAt  >  server.lastChangedAt   →  the server DB was
//   rolled back (crash/workspace restore/DB replaced)  →  restore the backup.
//
// Both timestamps come from THIS server's clock, so clock skew can never
// cause a false positive.
// ---------------------------------------------------------------------------

// Ensure the singleton settings row exists.
export async function ensureSettings() {
  let s = await db.settings.findUnique({ where: { id: "default" } });
  if (!s) {
    s = await db.settings.create({
      data: { id: "default", name: "Habit Tracker", theme: "light", ignoreDays: "[]" },
    });
  }
  return s;
}

// Bump the global version clock. Returns the new timestamp (ISO string).
export async function bumpLastChanged(): Promise<string> {
  const when = new Date();
  await ensureSettings();
  await db.settings.update({
    where: { id: "default" },
    data: { lastChangedAt: when },
  });
  return when.toISOString();
}

export async function getLastChanged(): Promise<string | null> {
  const s = await db.settings.findUnique({
    where: { id: "default" },
    select: { lastChangedAt: true },
  });
  return s?.lastChangedAt ? s.lastChangedAt.toISOString() : null;
}
