// Seed the database with default settings and a starter month mirroring the
// original "September Routines" sheet of "Habit tracker.xlsx".
// Run once with: bun run src/lib/seed.ts

import { db } from "./db";

const MONTH = 10; // October
const YEAR = 2026;

// Full-month goal: every day of the month (month-wise goals, not weekly).
const daysInMonth = (m: number, y: number) => new Date(y, m, 0).getDate();
const MONTH_GOAL = daysInMonth(MONTH, YEAR); // October → 31

// Default habits exactly as in the original spreadsheet's "September Routines" sheet.
const DEFAULT_HABITS: { name: string; category: string; goal: number }[] = [
  { name: "7hr sleep", category: "😴 Sleep & Rest", goal: MONTH_GOAL },
  { name: "15 glass water", category: "💧 Hydration", goal: MONTH_GOAL },
  { name: "45 min workout", category: "🏃 Fitness", goal: MONTH_GOAL },
  { name: "pre workout", category: "🏃 Fitness", goal: MONTH_GOAL },
  { name: "meal 1", category: "🥗 Nutrition", goal: MONTH_GOAL },
  { name: "meal 2", category: "🥗 Nutrition", goal: MONTH_GOAL },
  { name: "2hr build jarvis", category: "💼 Work", goal: MONTH_GOAL },
  { name: "30 min chess", category: "🧘 Mindfulness", goal: MONTH_GOAL },
  { name: "3 hr study", category: "📚 Learning", goal: MONTH_GOAL },
  { name: "no lust", category: "🧘 Mindfulness", goal: MONTH_GOAL },
  { name: "learn something new", category: "📚 Learning", goal: MONTH_GOAL },
  { name: "10 min reading book", category: "🌙 Evening Routine", goal: MONTH_GOAL },
];

async function main() {
  // Settings singleton
  const settings = await db.settings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      name: "Habit Tracker",
      theme: "light",
      ignoreDays: "[]",
    },
  });
  console.log("Settings ready:", settings.id);

  // Default month (October 2026)
  const existing = await db.month.findUnique({
    where: { month_year: { month: MONTH, year: YEAR } },
  });

  if (!existing) {
    const month = await db.month.create({
      data: {
        month: MONTH,
        year: YEAR,
        habits: {
          create: DEFAULT_HABITS.map((h, i) => ({
            name: h.name,
            category: h.category,
            goal: h.goal,
            order: i + 1,
          })),
        },
      },
    });
    console.log("Seeded month:", month.id, `${month.month}/${month.year}`);
  } else {
    console.log("Month already exists:", existing.id);
  }

  const months = await db.month.count();
  console.log("Total months:", months);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
