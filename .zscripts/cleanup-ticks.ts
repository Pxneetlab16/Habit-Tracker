import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const res = await db.checkmark.deleteMany({});
  console.log("Deleted checkmarks:", res.count);
  process.exit(0);
}
main();
