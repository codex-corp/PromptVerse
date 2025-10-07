import type { DatabaseClient } from "@/lib/db";
import { generateId } from "@/lib/id";

type SeedOptions = {
  csvUrl?: string;
  authorEmail?: string;
  authorName?: string;
  defaultModel?: string;
  engineeringCategoryName?: string;
  engineeringCategoryDescription?: string;
  engineeringCategoryColor?: string;
  generalCategoryName?: string;
  generalCategoryDescription?: string;
  generalCategoryColor?: string;
};

type SeedResult = {
  created: number;
  skipped: number;
  engineeringCategoryId: string;
  generalCategoryId: string;
};

const SOURCE_TAG = "prompts.chat";

function envValue(key: string, override?: string): string | undefined {
  if (override && override.length > 0) {
    return override;
  }

  if (typeof process !== "undefined" && process.env?.[key]) {
    return process.env[key];
  }

  const globalEnv =
    ((globalThis as any)?.__ENV__ as Record<string, any> | undefined) ??
    ((globalThis as any)?.env as Record<string, any> | undefined);

  const fromGlobal = globalEnv?.[key];
  if (typeof fromGlobal === "string" && fromGlobal.length > 0) {
    return fromGlobal;
  }

  return undefined;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === "\"") {
      if (inQuotes && line[i + 1] === "\"") {
        current += "\"";
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result.map((value) => value.replace(/^"|"$/g, "").replace(/""/g, '"'));
}

async function fetchCsv(csvUrl: string): Promise<string> {
  const response = await fetch(csvUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch CSV: ${response.status} ${response.statusText}`);
  }
  return await response.text();
}

async function ensureUser(db: DatabaseClient, email: string, name: string): Promise<string> {
  const existing = (await db
    .prepare<{ id: string }>("SELECT id FROM User WHERE email = ?")
    .get(email)) ?? null;

  if (existing?.id) {
    return existing.id;
  }

  const id = generateId();
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO User (id, email, name, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(id, email, name, now, now);

  return id;
}

async function ensureCategory(
  db: DatabaseClient,
  name: string,
  description: string,
  color: string,
): Promise<string> {
  const existing = (await db
    .prepare<{ id: string }>("SELECT id FROM Category WHERE name = ?")
    .get(name)) ?? null;

  if (existing?.id) {
    return existing.id;
  }

  const id = generateId();
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO Category (id, name, description, color, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(id, name, description, color, now, now);

  return id;
}

async function ensureTag(db: DatabaseClient, name: string, color = "#6366F1"): Promise<string> {
  const existing = (await db
    .prepare<{ id: string }>("SELECT id FROM Tag WHERE name = ?")
    .get(name)) ?? null;

  if (existing?.id) {
    return existing.id;
  }

  const id = generateId();
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO Tag (id, name, color, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(id, name, color, now, now);

  return id;
}

export async function seedPrompts(db: DatabaseClient, options: SeedOptions = {}): Promise<SeedResult> {
  const csvUrl = envValue("SEED_PROMPTS_URL", options.csvUrl) ??
    "https://raw.githubusercontent.com/f/awesome-chatgpt-prompts/refs/heads/main/prompts.csv";

  const authorEmail = (envValue("SEED_USER_EMAIL", options.authorEmail) ?? "hany@codexc.com").trim();
  const authorName = (envValue("SEED_USER_NAME", options.authorName) ?? "Hany alsamman").trim();
  const defaultModel = envValue("SEED_DEFAULT_MODEL", options.defaultModel) ?? "gpt-4o";

  const engineeringCategoryName = envValue(
    "SEED_PROMPTS_ENGINEERING_CATEGORY",
    options.engineeringCategoryName,
  ) ?? "Engineering Prompts";
  const engineeringCategoryDescription =
    options.engineeringCategoryDescription ?? "Imported engineering prompts from prompts.chat";
  const engineeringCategoryColor = envValue(
    "SEED_PROMPTS_ENGINEERING_COLOR",
    options.engineeringCategoryColor,
  ) ?? "#2563EB";

  const generalCategoryName = envValue(
    "SEED_PROMPTS_GENERAL_CATEGORY",
    options.generalCategoryName,
  ) ?? "General Prompts";
  const generalCategoryDescription =
    options.generalCategoryDescription ?? "General-purpose prompts from prompts.chat";
  const generalCategoryColor = envValue(
    "SEED_PROMPTS_GENERAL_COLOR",
    options.generalCategoryColor,
  ) ?? "#9333EA";

  const csv = await fetchCsv(csvUrl);
  const lines = csv.split(/\r?\n/).filter(Boolean);
  if (!lines.length) {
    throw new Error("CSV appears to be empty");
  }

  const header = lines.shift();
  if (!header) {
    throw new Error("CSV missing header row");
  }

  const headerCols = parseCsvLine(header);
  const titleIdx = headerCols.findIndex((col) => /act|title/i.test(col));
  const promptIdx = headerCols.findIndex((col) => /prompt/i.test(col));

  if (titleIdx === -1 || promptIdx === -1) {
    throw new Error("CSV must contain columns for title/act and prompt");
  }

  const authorId = await ensureUser(db, authorEmail, authorName);
  const engineeringCategoryId = await ensureCategory(
    db,
    engineeringCategoryName,
    engineeringCategoryDescription,
    engineeringCategoryColor,
  );
  const generalCategoryId = await ensureCategory(
    db,
    generalCategoryName,
    generalCategoryDescription,
    generalCategoryColor,
  );

  let created = 0;
  let skipped = 0;

  for (const line of lines) {
    const cols = parseCsvLine(line);
    const title = cols[titleIdx];
    const content = cols[promptIdx];

    if (!title || !content) {
      continue;
    }

    const isEngineering = /engineer|developer|code|debug/i.test(title);
    const categoryId = isEngineering ? engineeringCategoryId : generalCategoryId;

    const existing = (await db
      .prepare<{ id: string }>("SELECT id FROM prompts WHERE title = ?")
      .get(title)) ?? null;

    if (existing?.id) {
      skipped += 1;
      continue;
    }

    const promptId = generateId();
    const now = new Date().toISOString();
    const temperature = isEngineering ? 0.3 : 0.6;
    const notes = `Imported from prompts.chat (${isEngineering ? "engineering" : "general"})`;

    await db
      .prepare(
        `INSERT INTO prompts (
          id, title, content, description, targetModel,
          temperature, maxTokens, topP, frequencyPenalty, presencePenalty,
          notes, isFavorite, viewCount, createdAt, updatedAt, authorId, categoryId
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?)`
      )
      .run(
        promptId,
        title,
        content,
        null,
        defaultModel,
        temperature,
        1024,
        1,
        0,
        0,
        notes,
        now,
        now,
        authorId,
        categoryId,
      );

    await db
      .prepare(
        `INSERT INTO prompt_versions (
          id, title, content, description, targetModel,
          temperature, maxTokens, topP, frequencyPenalty, presencePenalty,
          notes, versionNote, createdAt, originalPromptId
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        generateId(),
        title,
        content,
        null,
        defaultModel,
        temperature,
        1024,
        1,
        0,
        0,
        notes,
        "Initial version",
        now,
        promptId,
      );

    const tagIds: string[] = [];
    for (const tag of [SOURCE_TAG, isEngineering ? "engineering" : "general"]) {
      const tagId = await ensureTag(db, tag);
      tagIds.push(tagId);
    }

    for (const tagId of tagIds) {
      await db
        .prepare(
          `INSERT INTO prompt_tags (id, promptId, tagId) VALUES (?, ?, ?)`
        )
        .run(generateId(), promptId, tagId);
    }

    created += 1;
  }

  return {
    created,
    skipped,
    engineeringCategoryId,
    generalCategoryId,
  };
}
