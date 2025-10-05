import "dotenv/config";
import { randomUUID } from "node:crypto";
import { db } from "../src/lib/db";

const TIMESTAMP = () => new Date().toISOString();

const ENGINEERING_CATEGORIES = [
  { name: "Code Quality", description: "Reviews, testing, and debugging workflows", color: "#3B82F6" },
  { name: "Architecture", description: "System design and trade-off analysis", color: "#10B981" },
  { name: "Operations", description: "Migrations, incidents, and runbooks", color: "#F59E0B" },
];

const SUPPORTED_MODELS: { name: string; provider: string }[] = [
  { name: "gpt-4o", provider: "openai" },
  { name: "gpt-4o-mini", provider: "openai" },
  { name: "gpt-4.1", provider: "openai" },
  { name: "gpt-4.1-mini", provider: "openai" },
  { name: "o1-mini", provider: "openai" },
  { name: "LongCat-Flash-Chat", provider: "longcat" },
  { name: "LongCat-Flash-Thinking", provider: "longcat" },
];

const DRIVER_USER = {
  email: (process.env.SEED_USER_EMAIL ?? "hany@codexc.com").trim(),
  name: (process.env.SEED_USER_NAME ?? "Hany alsamman").trim(),
};

function clearTables() {
  const tables = [
    "prompt_tags",
    "ratings",
    "prompt_versions",
    "prompts",
    "Tag",
    "Category",
    "User",
  ];

  for (const table of tables) {
    db.prepare(`DELETE FROM ${table}`).run();
  }
}

function insertUser() {
  const id = randomUUID();
  const now = TIMESTAMP();
  db.prepare(
    `INSERT INTO User (id, email, name, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, DRIVER_USER.email, DRIVER_USER.name, now, now);
  return id;
}

function insertCategory(name: string, description: string, color: string) {
  const id = randomUUID();
  const now = TIMESTAMP();
  db.prepare(
    `INSERT INTO Category (id, name, description, color, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, name, description, color, now, now);
  return id;
}

function insertTemplatePrompt({
  title,
  content,
  description,
  categoryId,
  authorId,
  model = "gpt-4o",
  tags = [],
}: {
  title: string;
  content: string;
  description: string;
  categoryId: string;
  authorId: string;
  model?: string;
  tags?: string[];
}) {
  const promptId = randomUUID();
  const now = TIMESTAMP();

  db.prepare(
    `INSERT INTO prompts (
      id, title, content, description, targetModel,
      temperature, maxTokens, topP, frequencyPenalty, presencePenalty,
      notes, isFavorite, viewCount, createdAt, updatedAt, authorId, categoryId
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    promptId,
    title,
    content,
    description,
    model,
    0.2,
    1024,
    1,
    0,
    0,
    "Seeded engineering template",
    0,
    0,
    now,
    now,
    authorId,
    categoryId
  );

  db.prepare(
    `INSERT INTO prompt_versions (
      id, title, content, description, targetModel,
      temperature, maxTokens, topP, frequencyPenalty, presencePenalty,
      notes, versionNote, createdAt, originalPromptId
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    randomUUID(),
    title,
    content,
    description,
    model,
    0.2,
    1024,
    1,
    0,
    0,
    "Seeded engineering template",
    "Initial version",
    now,
    promptId
  );

  for (const tag of tags) {
    const tagId = ensureTag(tag);
    db.prepare(
      `INSERT INTO prompt_tags (id, promptId, tagId)
       VALUES (?, ?, ?)`
    ).run(randomUUID(), promptId, tagId);
  }
}

function ensureTag(name: string) {
  const existing = db.prepare("SELECT id FROM Tag WHERE name = ?").get(name) as { id: string } | undefined;
  if (existing) return existing.id;

  const id = randomUUID();
  const now = TIMESTAMP();
  db.prepare(
    `INSERT INTO Tag (id, name, color, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, name, "#6366F1", now, now);
  return id;
}

function seedEngineeringTemplates(authorId: string, categories: Record<string, string>) {
  insertTemplatePrompt({
    title: "Code review risk radar",
    description: "Staff engineer style code review focused on regressions and missing tests.",
    content:
      "Review this pull request like a staff engineer. Highlight regressions, missing tests, and risk areas.\n\nProject: [repo]\nImpact: [blast radius]\nStandards: [tests/perf/docs]\nSummary: [paste]\nDiff: [paste]\n\nAnswer with Merge Blockers, High Priority, Questions, Test Gaps, Nice-to-haves.",
    categoryId: categories["Code Quality"],
    authorId,
    tags: ["code-review", "quality"],
  });

  insertTemplatePrompt({
    title: "Architecture trade study",
    description: "Compare implementation options with pros/cons and recommendation.",
    content:
      "Act as a principal engineer. Compare Option A/B/C for [problem]. Include pros/cons, risks, mitigations, and recommend the best fit against success criteria [list].",
    categoryId: categories["Architecture"],
    authorId,
    tags: ["architecture", "trade-off"],
  });

  insertTemplatePrompt({
    title: "Migration runbook",
    description: "Draft phased migration steps with rollback.",
    content:
      "Plan a phased migration for [change]. Include readiness checklist, execution steps per environment, rollback plan, monitoring, and comms.",
    categoryId: categories["Operations"],
    authorId,
    tags: ["migration", "runbook"],
  });
}

function seedModelsIfPresent() {
  const tableExists = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='Model'")
    .get() as { name?: string } | undefined;

  if (!tableExists) {
    console.warn("Model table not found; skipping model seed.");
    return;
  }

  db.prepare("DELETE FROM Model").run();
  const now = TIMESTAMP();
  for (const model of SUPPORTED_MODELS) {
    db.prepare(
      `INSERT INTO Model (id, name, provider, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?)`
    ).run(randomUUID(), model.name, model.provider, now, now);
  }
}

async function main() {
  console.log("Seeding database with baseline data...");
  clearTables();

  seedModelsIfPresent();
  const authorId = insertUser();

  const categoryMap: Record<string, string> = {};
  for (const category of ENGINEERING_CATEGORIES) {
    categoryMap[category.name] = insertCategory(category.name, category.description, category.color);
  }

  seedEngineeringTemplates(authorId, categoryMap);

  console.log("Seed completed");
}

main()
  .catch((error) => {
    console.error("Seed failed", error);
    process.exit(1);
  })
  .finally(() => {
    db.close();
  });
