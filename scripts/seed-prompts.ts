import "dotenv/config";
import { db } from "../src/lib/db";
import fs from "fs";
import path from "path";
import { randomUUID } from "node:crypto";

async function main() {
    console.log("Seeding prompts from CSV...");

    const authorEmail = "hany@example.com";
    let author = db.prepare("SELECT id FROM User WHERE email = ?").get(authorEmail) as { id: string } | undefined;

    if (!author) {
        const authorId = randomUUID();
        const now = new Date().toISOString();
        db.prepare("INSERT INTO User (id, email, name, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)").run(authorId, authorEmail, "hany alsamman", now, now);
        author = { id: authorId };
    }

    const codeGenCategory = db.prepare("SELECT id FROM Category WHERE name = ?").get("Code Generation") as { id: string } | undefined;
    const creativeWritingCategory = db.prepare("SELECT id FROM Category WHERE name = ?").get("Creative Writing") as { id: string } | undefined;

    if (!codeGenCategory || !creativeWritingCategory) {
        console.error("Please ensure that 'Code Generation' and 'Creative Writing' categories exist in the database.");
        return;
    }

    const csvPath = path.join(__dirname, "../prompts.csv");
    const csvData = fs.readFileSync(csvPath, "utf-8");
    const rows = csvData.split("\n").filter(row => row.trim() !== "");

    for (const row of rows) {
        const [title, content, isTechStr] = row.split(",");
        const isTech = isTechStr.trim().toUpperCase() === "TRUE";

        const promptId = randomUUID();
        const now = new Date().toISOString();

        db.prepare(
            `INSERT INTO prompts (
              id, title, content, description, targetModel,
              temperature, maxTokens, topP, frequencyPenalty,
              presencePenalty, notes, isFavorite, viewCount,
              createdAt, updatedAt, authorId, categoryId
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?)`
        ).run(
            promptId,
            title.replace(/"/g, ""),
            content.replace(/"/g, ""),
            null,
            "GPT-4",
            0.7,
            1000,
            1.0,
            0,
            0,
            null,
            now,
            now,
            author.id,
            isTech ? codeGenCategory.id : creativeWritingCategory.id
        );
    }

    console.log("Prompts seeded successfully!");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => {
        db.close();
    });
