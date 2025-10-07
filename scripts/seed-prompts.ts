import "dotenv/config";
import { getLocalDatabase } from "../src/lib/db";
import { seedPrompts } from "../src/lib/seed-prompts";

async function run() {
  const db = getLocalDatabase();
  const result = await seedPrompts(db);
  console.log(
    `Seed completed. Created ${result.created} prompts (skipped ${result.skipped}).\n` +
      `Engineering category: ${result.engineeringCategoryId}\n` +
      `General category: ${result.generalCategoryId}`,
  );
}

run().catch((error) => {
  console.error("Failed to seed prompts:", error);
  process.exit(1);
});
