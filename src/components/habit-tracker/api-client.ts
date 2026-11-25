"use client";

// Tiny typed fetch wrapper for the habit-tracker API.

import type { StateMirror } from "./state-mirror";

export interface Settings {
  id: string;
  name: string;
  theme: "light" | "dark";
  ignoreDays: string[]; // weekday names, e.g. ["Sunday"]
}

export interface CheckmarkData {
  day: number;
  done: boolean;
}

export interface HabitData {
  id: string;
  name: string;
  category: string;
  order: number;
  goal: number;
  checkmarks: CheckmarkData[];
}

export interface MealCheckData {
  day: number;
  done: boolean;
}

// Diet table row — mirrors HabitData (same shape, diet fields named "checks").
export interface MealData {
  id: string;
  name: string;
  category: string; // meal type, e.g. "🍳 Breakfast"
  order: number;
  goal: number;
  checks: MealCheckData[];
}

export interface MonthData {
  id: string;
  month: number;
  year: number;
  title: string | null;
  habits: HabitData[];
  meals: MealData[];
}

export interface MonthListItem {
  id: string;
  month: number;
  year: number;
  title: string | null;
  habitCount: number;
  mealCount: number;
  createdAt: string;
}

// Complete server state in one response (GET /api/bootstrap).
export interface BootstrapMonth extends MonthData {
  createdAt: string;
}

export interface BootstrapData {
  settings: Settings;
  lastChangedAt: string | null; // global data version clock
  months: BootstrapMonth[];
}

async function jfetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  // Any successful mutation changes the server state → tell the device-backup
  // mirror (state-mirror.ts) to snapshot the new state. One central hook
  // covers every mutating API call in the app.
  if (init?.method && init.method !== "GET" && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("ht:state-mutated"));
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const settingsApi = {
  get: () => jfetch<Settings>("/api/settings"),
  update: (data: Partial<Pick<Settings, "name" | "theme" | "ignoreDays">>) =>
    jfetch<Settings>("/api/settings", { method: "PATCH", body: JSON.stringify(data) }),
};

export const monthsApi = {
  list: () => jfetch<MonthListItem[]>("/api/months"),
  create: (data: { month: number; year: number; title?: string; cloneFromId?: string }) =>
    jfetch<MonthData>("/api/months", { method: "POST", body: JSON.stringify(data) }),
  get: (id: string) => jfetch<MonthData>(`/api/months/${id}`),
  update: (id: string, data: { title?: string | null }) =>
    jfetch<MonthData>(`/api/months/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  remove: (id: string) => jfetch<{ ok: boolean }>(`/api/months/${id}`, { method: "DELETE" }),
  addHabit: (id: string, data: { name: string; category: string; goal: number }) =>
    jfetch<HabitData>(`/api/months/${id}/habits`, { method: "POST", body: JSON.stringify(data) }),
  addMeal: (id: string, data: { name: string; category: string; goal: number }) =>
    jfetch<MealData>(`/api/months/${id}/meals`, { method: "POST", body: JSON.stringify(data) }),
};

export const habitsApi = {
  update: (id: string, data: { name?: string; category?: string; goal?: number }) =>
    jfetch<HabitData>(`/api/habits/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  remove: (id: string) => jfetch<{ ok: boolean }>(`/api/habits/${id}`, { method: "DELETE" }),
  // Drag-and-drop reorder: send ALL habit ids of the month in their new order.
  reorder: (orderedIds: string[]) =>
    jfetch<{ ok: boolean; order: string[] }>("/api/habits/reorder", {
      method: "POST",
      body: JSON.stringify({ orderedIds }),
    }),
};

export const checkmarksApi = {
  set: (data: { habitId: string; day: number; done: boolean }) =>
    jfetch<{ id: string; habitId: string; day: number; done: boolean }>("/api/checkmarks", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

export const mealsApi = {
  update: (id: string, data: { name?: string; category?: string; goal?: number }) =>
    jfetch<MealData>(`/api/meals/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  remove: (id: string) => jfetch<{ ok: boolean }>(`/api/meals/${id}`, { method: "DELETE" }),
  // Drag-and-drop reorder: send ALL meal ids of the month in their new order.
  reorder: (orderedIds: string[]) =>
    jfetch<{ ok: boolean; order: string[] }>("/api/meals/reorder", {
      method: "POST",
      body: JSON.stringify({ orderedIds }),
    }),
};

export const mealChecksApi = {
  set: (data: { mealId: string; day: number; done: boolean }) =>
    jfetch<{ id: string; mealId: string; day: number; done: boolean }>("/api/meal-checks", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// Full-state read (settings + version clock + all months with habits/ticks).
export const bootstrapApi = {
  get: () => jfetch<BootstrapData>("/api/bootstrap"),
};

// Self-healing restore: push the device backup back onto the server when the
// server DB has been rolled back (detected via lastChangedAt comparison).
export const restoreApi = {
  post: (mirror: StateMirror) =>
    jfetch<{ ok: boolean; lastChangedAt: string; months: number }>("/api/restore", {
      method: "POST",
      body: JSON.stringify(mirror),
    }),
};

// All habit categories from the original spreadsheet (used as the picker list).
export const ALL_CATEGORIES: string[] = [
  "🌿 Wellness",
  "🧘 Mindfulness",
  "🏃 Fitness",
  "💧 Hydration",
  "🥗 Nutrition",
  "😴 Sleep & Rest",
  "📚 Learning",
  "✍️ Journaling",
  "🕯️ Self-Care",
  "💼 Work",
  "💰 Finance",
  "🏡 Home",
  "🧹 Cleaning",
  "🛒 Errands",
  "🤍 Relationships",
  "🎨 Creativity",
  "🌙 Evening Routine",
  "☀️ Morning Routine",
  "🙏 Spirituality",
  "📵 Digital Wellness",
  "🌸 Personal Growth",
];

// Meal types for the diet table (used as the picker list in the meal dialog).
export const MEAL_CATEGORIES: string[] = [
  "🍳 Breakfast",
  "🍽️ Lunch",
  "🌙 Dinner",
  "🍎 Snacks",
  "🥤 Beverages",
  "🍰 Cheat Meal",
  "🥐 Brunch",
  "🥗 Salad",
  "💪 Post-Workout Meal",
  "🍲 Pre-Workout Meal",
];

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Map weekday name → JS getDay() index (single source of truth for ignore-days).
export const WEEKDAY_NAME_TO_INDEX: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

// Convert weekday names (e.g. ["Sunday"]) into a Set of JS day indices (0..6).
export function ignoreDaysToIndices(ignoreDays: string[]): Set<number> {
  return new Set(
    ignoreDays
      .map((d) => WEEKDAY_NAME_TO_INDEX[d])
      .filter((x) => x !== undefined),
  );
}

// All days of the month that are NOT ignored (i.e. the visible columns).
// This is the single source of truth for "visible days" — used by the table,
// stats, the chart and the full-month goal everywhere in the app.
export function visibleDaysInMonth(
  month: number,
  year: number,
  ignoreDays: string[],
): number[] {
  const total = daysInMonth(month, year);
  const ignoreIndices = ignoreDaysToIndices(ignoreDays);
  return Array.from({ length: total }, (_, i) => i + 1).filter(
    (d) => !ignoreIndices.has(weekdayOfDay(month, year, d)),
  );
}

// The full-month goal for ONE habit: every visible (non-ignored) day of the
// month. November → 30, October → 31; ignoring Sundays in a 31-day month with
// 4 Sundays → 27. This replaces the old fixed weekly goal of 7.
export function monthGoalDays(
  month: number,
  year: number,
  ignoreDays: string[],
): number {
  return visibleDaysInMonth(month, year, ignoreDays).length;
}

// Week color helpers (must match globals.css variables).
// We support up to 6 Mon-Sun calendar weeks (a 31-day month starting on Sat/Sun can span 6 weeks).
export const WEEK_COLORS = [
  { bg: "var(--week-1-bg)", date: "var(--week-1-date)", cell: "var(--week-1-cell)", check: "var(--week-1-check)" },
  { bg: "var(--week-2-bg)", date: "var(--week-2-date)", cell: "var(--week-2-cell)", check: "var(--week-2-check)" },
  { bg: "var(--week-3-bg)", date: "var(--week-3-date)", cell: "var(--week-3-cell)", check: "var(--week-3-check)" },
  { bg: "var(--week-4-bg)", date: "var(--week-4-date)", cell: "var(--week-4-cell)", check: "var(--week-4-check)" },
  { bg: "var(--week-5-bg)", date: "var(--week-5-date)", cell: "var(--week-5-cell)", check: "var(--week-5-check)" },
  { bg: "var(--week-6-bg)", date: "var(--week-6-date)", cell: "var(--week-6-cell)", check: "var(--week-6-check)" },
];

// Returns 0..5 — which Mon-Sun calendar week a given day-of-month belongs to.
// Week 1 always starts on the 1st of the month (even if it's not Monday) and ends on
// the first Sunday. Subsequent weeks run Monday → Sunday.
//
// Algorithm: count how many Mondays have occurred from day 1 up to and including `day`.
// Each Monday (after day 1) starts a new week.
export function weekIndexForDay(month: number, year: number, day: number): number {
  // JS getDay: 0=Sun..6=Sat. weekday-of-day-1:
  const wd1 = new Date(year, month - 1, 1).getDay();
  // days-since-Monday for day 1 (Mon=0, Tue=1, ..., Sun=6)
  const offset0 = (wd1 + 6) % 7;
  // Week index for `day`:
  return Math.floor((day - 1 + offset0) / 7);
}

export function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate(); // day 0 = last day of previous month
}

export function weekdayOfDay(month: number, year: number, day: number): number {
  // JS: 0 = Sunday, 6 = Saturday. month is 1-12.
  return new Date(year, month - 1, day).getDay();
}
