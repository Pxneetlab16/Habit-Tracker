import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const months = await db.month.findMany({ select: { id: true, month: true, year: true } });
  console.log("MONTHS:", JSON.stringify(months));
  const habits = await db.habit.findMany({ select: { id: true, monthId: true, name: true, goal: true, order: true } });
  console.log("HABITS:", JSON.stringify(habits));
  const settings = await db.settings.findMany();
  console.log("SETTINGS:", JSON.stringify(settings));
  const doneCount = await db.checkmark.count({ where: { done: true } });
  console.log("DONE CHECKMARKS:", doneCount);
  process.exit(0);
}
main();
