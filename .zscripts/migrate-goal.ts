// One-time migration: replace the old fixed weekly goal (7) with the
// month-wise full-month goal (days in that habit's month).
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

const daysInMonth = (m: number, y: number) => new Date(y, m, 0).getDate();

async function main() {
  const months = await db.month.findMany({ include: { habits: true } });
  let updated = 0;
  for (const m of months) {
    const goal = daysInMonth(m.month, m.year);
    const res = await db.habit.updateMany({
      where: { monthId: m.id },
      data: { goal },
    });
    updated += res.count;
    console.log(`Month ${m.month}/${m.year}: set ${res.count} habits → goal ${goal}`);
  }
  console.log("Total habits updated:", updated);
  process.exit(0);
}
main();
