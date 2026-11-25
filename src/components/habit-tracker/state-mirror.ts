"use client";

// ---------------------------------------------------------------------------
// Device backup ("state mirror") — the never-lose-data layer.
//
// The server SQLite DB is the primary memory, but this sandbox's workspace
// can be rolled back to an older snapshot (that is exactly how the user's
// ticks / ignored days / habit changes were lost once: the server DB went
// back in time while the browser's localStorage survived).
//
// So after EVERY change the whole app state is snapshotted into
// localStorage here — the same trick that already made the theme stick.
// On startup the app compares this backup's timestamp against the server's
// data-version clock (Settings.lastChangedAt, bumped by every mutating API
// call). If the backup is NEWER than the server, the server was rolled back
// and the app automatically restores the backup onto the server.
//
// Guards:
// - A newer backup is NEVER overwritten by an older server snapshot.
// - Both timestamps originate from the same server clock → no clock-skew
//   false positives.
// ---------------------------------------------------------------------------

import { bootstrapApi, type BootstrapData } from "./api-client";

const MIRROR_KEY = "ht-state-mirror-v1";

export interface MirrorCheckmark {
  day: number;
  done: boolean;
}

export interface MirrorHabit {
  id: string;
  name: string;
  category: string;
  order: number;
  goal: number;
  checkmarks: MirrorCheckmark[];
}

export interface MirrorMeal {
  id: string;
  name: string;
  category: string;
  order: number;
  goal: number;
  checks: MirrorCheckmark[];
}

export interface MirrorMonth {
  id: string;
  month: number;
  year: number;
  title: string | null;
  createdAt?: string;
  habits: MirrorHabit[];
  // Optional so backups written before the diet feature still load fine —
  // they simply restore with an empty diet table.
  meals?: MirrorMeal[];
}

export interface StateMirror {
  version: 1;
  savedAt: string; // client clock when this backup was written
  serverChangedAt: string | null; // server's lastChangedAt observed at save time
  settings: {
    name: string;
    theme: "light" | "dark";
    ignoreDays: string[];
  };
  months: MirrorMonth[];
}

export function loadStateMirror(): StateMirror | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(MIRROR_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<StateMirror> | null;
    if (!p || p.version !== 1 || !Array.isArray(p.months)) return null;
    if (!p.settings || typeof p.settings.name !== "string") return null;
    return p as StateMirror;
  } catch {
    return null;
  }
}

// Save a fresh backup from a bootstrap response.
// Returns false (and keeps the existing backup) when the existing backup is
// NEWER than the server state — that backup is exactly what we must protect.
export function saveStateMirrorFromBootstrap(boot: BootstrapData): boolean {
  if (typeof window === "undefined") return false;
  try {
    const existing = loadStateMirror();
    if (existing?.serverChangedAt) {
      const mT = Date.parse(existing.serverChangedAt);
      const sT = boot.lastChangedAt ? Date.parse(boot.lastChangedAt) : NaN;
      if (Number.isFinite(mT) && (!Number.isFinite(sT) || mT > sT)) {
        return false; // server looks rolled back — keep the newer backup
      }
    }
    const mirror: StateMirror = {
      version: 1,
      savedAt: new Date().toISOString(),
      serverChangedAt: boot.lastChangedAt ?? null,
      settings: {
        name: boot.settings.name,
        theme: boot.settings.theme === "dark" ? "dark" : "light",
        ignoreDays: Array.isArray(boot.settings.ignoreDays) ? boot.settings.ignoreDays : [],
      },
      months: boot.months.map((m) => ({
        id: m.id,
        month: m.month,
        year: m.year,
        title: m.title,
        createdAt: m.createdAt,
        habits: m.habits.map((h) => ({
          id: h.id,
          name: h.name,
          category: h.category,
          order: h.order,
          goal: h.goal,
          checkmarks: h.checkmarks.map((c) => ({ day: c.day, done: c.done })),
        })),
        meals: (m.meals ?? []).map((ml) => ({
          id: ml.id,
          name: ml.name,
          category: ml.category,
          order: ml.order,
          goal: ml.goal,
          checks: (ml.checks ?? []).map((c) => ({ day: c.day, done: c.done })),
        })),
      })),
    };
    window.localStorage.setItem(MIRROR_KEY, JSON.stringify(mirror));
    return true;
  } catch (e) {
    console.warn("Failed to write device backup", e);
    return false;
  }
}

// Fetch the complete server state and store it as the device backup.
let inflight: Promise<boolean> | null = null;

export function refreshMirrorNow(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (inflight) return inflight;
  inflight = bootstrapApi
    .get()
    .then((boot) => saveStateMirrorFromBootstrap(boot))
    .catch((e) => {
      console.warn("Device-backup refresh failed", e);
      return false;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

// Leading + trailing debounce: the first mutation snapshots immediately,
// rapid bursts (fast ticking) collapse into one trailing refresh.
let trailing: ReturnType<typeof setTimeout> | null = null;
let lastLeading = 0;

export function queueMirrorRefresh() {
  if (typeof window === "undefined") return;
  const now = Date.now();
  if (now - lastLeading > 1500) {
    lastLeading = now;
    void refreshMirrorNow();
  }
  if (trailing) clearTimeout(trailing);
  trailing = setTimeout(() => {
    trailing = null;
    lastLeading = Date.now();
    void refreshMirrorNow();
  }, 800);
}

// api-client dispatches this event after every successful mutating request,
// so every change (tick, goal edit, reorder, ignore day, theme, months…)
// lands in the device backup without any component-level wiring.
const MUTATED_EVENT = "ht:state-mutated";

if (typeof window !== "undefined") {
  window.addEventListener(MUTATED_EVENT, () => queueMirrorRefresh());
}

// For the Settings dialog's status line.
export function getLastBackupAt(): string | null {
  return loadStateMirror()?.savedAt ?? null;
}
