import "dotenv/config";
import { randomUUID } from "node:crypto";
import { db } from "../src/lib/db";

function resetDatabase() {
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

function insertUser(email: string, name: string) {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO User (id, email, name, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, email, name, now, now);
  return id;
}

function insertCategory(name: string, description: string, color: string) {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO Category (id, name, description, color, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, name, description, color, now, now);
  return id;
}

function insertTag(name: string, color: string) {
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

function insertPrompt(data: {
  title: string;
  content: string;
  description: string;
  targetModel: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  notes: string;
  isFavorite: boolean;
  viewCount: number;
  authorId: string;
  categoryId: string;
  tags: string[];
}) {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO prompts (
      id, title, content, description, targetModel,
      temperature, maxTokens, topP, frequencyPenalty,
      presencePenalty, notes, isFavorite, viewCount,
      createdAt, updatedAt, authorId, categoryId
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    data.title,
    data.content,
    data.description,
    data.targetModel,
    data.temperature,
    data.maxTokens,
    data.topP,
    data.frequencyPenalty,
    data.presencePenalty,
    data.notes,
    data.isFavorite ? 1 : 0,
    data.viewCount,
    now,
    now,
    data.authorId,
    data.categoryId
  );

  const tagPalette: Record<string, string> = {
    blog: "#3B82F6",
    content: "#10B981",
    marketing: "#F59E0B",
    react: "#06B6D4",
    typescript: "#3178C6",
    component: "#007ACC",
    ecommerce: "#059669",
    product: "#DC2626",
    sales: "#EA580C",
  };

  for (const name of data.tags) {
    const tagId = insertTag(name, tagPalette[name] ?? "#6366F1");
    db.prepare(
      `INSERT INTO prompt_tags (id, promptId, tagId)
       VALUES (?, ?, ?)`
    ).run(randomUUID(), id, tagId);
  }

  db.prepare(
    `INSERT INTO prompt_versions (
      id, title, content, description, targetModel,
      temperature, maxTokens, topP, frequencyPenalty,
      presencePenalty, notes, versionNote, createdAt, originalPromptId
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    randomUUID(),
    data.title,
    data.content,
    data.description,
    data.targetModel,
    data.temperature,
    data.maxTokens,
    data.topP,
    data.frequencyPenalty,
    data.presencePenalty,
    data.notes,
    "Initial version",
    now,
    id
  );

  return id;
}

function insertRating(promptId: string, userId: string, value: number, comment: string | null) {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO ratings (id, promptId, userId, value, comment, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(randomUUID(), promptId, userId, value, comment, now, now);
}

async function main() {
  console.log("Seeding database...");
  resetDatabase();

  const johnId = insertUser("john@example.com", "John Doe");
  const janeId = insertUser("jane@example.com", "Jane Smith");
  const mikeId = insertUser("mike@example.com", "Mike Johnson");

  const marketingId = insertCategory(
    "Marketing",
    "Marketing and content creation prompts",
    "#3B82F6"
  );
  const codeId = insertCategory(
    "Code Generation",
    "Programming and development prompts",
    "#10B981"
  );
  const creativeId = insertCategory(
    "Creative Writing",
    "Creative and storytelling prompts",
    "#F59E0B"
  );

  const prompt1 = insertPrompt({
    title: "Blog Post Introduction",
    content:
      "Write a compelling introduction for a blog post about [topic]. The introduction should grab the reader's attention, present the main problem or question, and provide a brief overview of what will be covered.",
    description: "Perfect for creating engaging blog post openings",
    targetModel: "GPT-4",
    temperature: 0.7,
    maxTokens: 1000,
    topP: 1,
    frequencyPenalty: 0,
    presencePenalty: 0,
    notes:
      "This prompt works best for informational blog posts. Adjust the temperature for more creative variations.",
    isFavorite: true,
    viewCount: 156,
    authorId: johnId,
    categoryId: marketingId,
    tags: ["blog", "content", "marketing"],
  });

  const prompt2 = insertPrompt({
    title: "React Component Generator",
    content:
      "Create a React component that [description]. The component should be functional, use hooks if necessary, and include proper TypeScript types. Make it reusable and well-documented.",
    description: "Generate clean React components with TypeScript",
    targetModel: "GPT-4",
    temperature: 0.3,
    maxTokens: 2000,
    topP: 1,
    frequencyPenalty: 0,
    presencePenalty: 0,
    notes:
      "Ideal for generating boilerplate components. Lower temperature ensures more consistent output.",
    isFavorite: true,
    viewCount: 203,
    authorId: janeId,
    categoryId: codeId,
    tags: ["react", "typescript", "component"],
  });

  const prompt3 = insertPrompt({
    title: "Product Description",
    content:
      "Write a persuasive product description for [product name]. Highlight the key features, benefits, and unique selling points. Use emotional language and include a call to action.",
    description: "Create compelling product descriptions that convert",
    targetModel: "Claude 3",
    temperature: 0.8,
    maxTokens: 800,
    topP: 0.9,
    frequencyPenalty: 0.5,
    presencePenalty: 0.5,
    notes: "Higher temperature helps create more engaging and varied marketing copy.",
    isFavorite: false,
    viewCount: 89,
    authorId: mikeId,
    categoryId: marketingId,
    tags: ["ecommerce", "product", "sales"],
  });

  insertRating(prompt1, johnId, 5, "Excellent prompt for creating engaging blog intros!");
  insertRating(prompt2, janeId, 4, "Great for boilerplate code, sometimes needs adjustments");
  insertRating(prompt1, mikeId, 4, null);

  console.log("Seed data created successfully.");
}

main().catch((error) => {
  console.error("Seed failed", error);
  process.exit(1);
});
