import "dotenv/config";
import { createRequire } from "node:module";
import { getLocalDatabase } from "../src/lib/db";
import { seedPrompts } from "../src/lib/seed-prompts";

const ensureNonWebpackRequire = () => {
  const globalAny = globalThis as any;
  if (typeof globalAny.__non_webpack_require__ === "function") {
    return;
  }

  const requireFn = createRequire(import.meta.url);
  globalAny.__non_webpack_require__ = requireFn;
};

async function run() {
  ensureNonWebpackRequire();
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
