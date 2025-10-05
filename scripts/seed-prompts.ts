import "dotenv/config";
import { db } from "../src/lib/db";
import fs from "fs";
import path from "path";
import https from "https";
import { randomUUID } from "node:crypto";

const AUTHOR_EMAIL = (process.env.SEED_USER_EMAIL ?? "hany@codexc.com").trim();
const AUTHOR_NAME = (process.env.SEED_USER_NAME ?? "Hany alsamman").trim();
const DEFAULT_MODEL = process.env.SEED_DEFAULT_MODEL ?? "gpt-4o";

const ENGINEERING_CATEGORY_NAME = process.env.SEED_PROMPTS_ENGINEERING_CATEGORY ?? "Engineering Prompts";
const ENGINEERING_CATEGORY_DESCRIPTION = "Imported engineering prompts from prompts.chat";
const ENGINEERING_CATEGORY_COLOR = process.env.SEED_PROMPTS_ENGINEERING_COLOR ?? "#2563EB";

const GENERAL_CATEGORY_NAME = process.env.SEED_PROMPTS_GENERAL_CATEGORY ?? "General Prompts";
const GENERAL_CATEGORY_DESCRIPTION = "General-purpose prompts from prompts.chat";
const GENERAL_CATEGORY_COLOR = process.env.SEED_PROMPTS_GENERAL_COLOR ?? "#9333EA";

const SOURCE_TAG = "prompts.chat";
const CSV_URL = process.env.SEED_PROMPTS_URL?.trim() || "https://raw.githubusercontent.com/f/awesome-chatgpt-prompts/refs/heads/main/prompts.csv";

function ensureUser() {
    const existing = db.prepare("SELECT id FROM User WHERE email = ?").get(AUTHOR_EMAIL) as { id: string } | undefined;
    if (existing) return existing.id;

    const id = randomUUID();
    const now = new Date().toISOString();
    db.prepare(
        `INSERT INTO User (id, email, name, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?)`
    ).run(id, AUTHOR_EMAIL, AUTHOR_NAME, now, now);
    return id;
}

function ensureCategory(name: string, description: string, color: string) {
    const existing = db.prepare("SELECT id FROM Category WHERE name = ?").get(name) as { id: string } | undefined;
    if (existing) return existing.id;

    const id = randomUUID();
    const now = new Date().toISOString();
    db.prepare(
        `INSERT INTO Category (id, name, description, color, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, name, description, color, now, now);
    return id;
}

function ensureTag(name: string, color = "#6366F1") {
    const existing = db.prepare("SELECT id FROM Tag WHERE name = ?").get(name) as { id: string } | undefined;
    if (existing) return existing.id;

    const id = randomUUID();
    const now = new Date().toISOString();
    db.prepare(
        `INSERT INTO Tag (id, name, color, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?)`
    ).run(id, name, color, now, now);
    return id;
}

function parseCsvLine(line: string) {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
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

function fetchCsv(): Promise<string> {
    return new Promise((resolve, reject) => {
        const onError = (error: Error) => reject(error);

        if (CSV_URL.startsWith("http")) {
            https
                .get(CSV_URL, (res) => {
                    if (res.statusCode && res.statusCode >= 400) {
                        reject(new Error(`Failed to fetch CSV: ${res.statusCode}`));
                        return;
                    }

                    const chunks: Buffer[] = [];
                    res.on("data", (chunk) => chunks.push(chunk));
                    res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
                })
                .on("error", onError);
        } else {
            const csvPath = path.isAbsolute(CSV_URL)
                ? CSV_URL
                : path.join(__dirname, CSV_URL);

            if (!fs.existsSync(csvPath)) {
                reject(new Error(`Could not find CSV file at ${csvPath}`));
                return;
            }

            resolve(fs.readFileSync(csvPath, "utf-8"));
        }
    });
}

function insertPrompt({
    title,
    content,
    categoryId,
    authorId,
    isEngineering,
}: {
    title: string;
    content: string;
    categoryId: string;
    authorId: string;
    isEngineering: boolean;
}) {
    const existing = db.prepare("SELECT id FROM prompts WHERE title = ?").get(title) as { id: string } | undefined;
    if (existing) {
        console.log(`Skipping existing prompt: ${title}`);
        return false;
    }

    const promptId = randomUUID();
    const now = new Date().toISOString();
    const temperature = isEngineering ? 0.3 : 0.6;
    const notes = `Imported from prompts.chat (${isEngineering ? "engineering" : "general"})`;

    db.prepare(
        `INSERT INTO prompts (
          id, title, content, description, targetModel,
          temperature, maxTokens, topP, frequencyPenalty, presencePenalty,
          notes, isFavorite, viewCount, createdAt, updatedAt, authorId, categoryId
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?)`
    ).run(
        promptId,
        title,
        content,
        null,
        DEFAULT_MODEL,
        temperature,
        1024,
        1,
        0,
        0,
        notes,
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
        null,
        DEFAULT_MODEL,
        temperature,
        1024,
        1,
        0,
        0,
        notes,
        "Initial version",
        now,
        promptId
    );

    const tagIds = [SOURCE_TAG, isEngineering ? "engineering" : "general"].map((tag) => ensureTag(tag));
    for (const tagId of tagIds) {
        db.prepare(
            `INSERT INTO prompt_tags (id, promptId, tagId) VALUES (?, ?, ?)`
        ).run(randomUUID(), promptId, tagId);
    }

    return true;
}

async function main() {
    console.log(`Importing prompts from ${CSV_URL} ...`);

    const authorId = ensureUser();
    const engineeringCategoryId = ensureCategory(
        ENGINEERING_CATEGORY_NAME,
        ENGINEERING_CATEGORY_DESCRIPTION,
        ENGINEERING_CATEGORY_COLOR
    );
    const generalCategoryId = ensureCategory(
        GENERAL_CATEGORY_NAME,
        GENERAL_CATEGORY_DESCRIPTION,
        GENERAL_CATEGORY_COLOR
    );

    const rawCsv = await fetchCsv();
    const rows = rawCsv
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map(parseCsvLine)
        .filter((columns) => columns.length >= 3)
        .map(([title, content, forDev]) => ({
            title,
            content,
            isEngineering: /^true$/i.test(forDev ?? ""),
        }))
        .filter((row) => row.isEngineering);
    if (!rows.length) {
        console.warn("No rows found in prompts.csv");
        return;
    }

    let inserted = 0;
    for (const row of rows) {
        const success = insertPrompt({
            title: row.title,
            content: row.content,
            categoryId: row.isEngineering ? engineeringCategoryId : generalCategoryId,
            authorId,
            isEngineering: row.isEngineering,
        });
        if (success) inserted += 1;
    }

    console.log(`Imported ${inserted} prompts (source: prompts.chat).`);
}

main()
    .catch((error) => {
        console.error("Failed to import prompts", error);
        process.exit(1);
    })
    .finally(() => {
        db.close();
    });
