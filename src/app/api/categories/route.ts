import { NextRequest, NextResponse } from "next/server";
import { getDatabaseClient } from "@/lib/db";
import { getRequestContext } from "@cloudflare/next-on-pages";
import { generateId } from "@/lib/id";

export const runtime = process.env.NEXT_RUNTIME === "edge" ? "edge" : "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeCounts = searchParams.get("includeCounts") === "true";

    let env: any; try { env = getRequestContext().env; } catch { env = undefined; }
    const db = getDatabaseClient(env);

    if (includeCounts) {
      // Get categories with prompt counts
      const categories = await db
        .prepare(`
          SELECT c.id, c.name, c.description, c.color, c.createdAt, c.updatedAt,
                 COUNT(p.id) AS count
          FROM Category c
          LEFT JOIN prompts p ON p.categoryId = c.id
          GROUP BY c.id
          ORDER BY c.name ASC
        `)
        .all();

      const totalRow = await db
        .prepare<{ total: number }>("SELECT COUNT(*) as total FROM prompts")
        .get();
      const totalPrompts = totalRow?.total ?? 0;

      return NextResponse.json({
        categories,
        total: totalPrompts
      });
    } else {
      // Get simple categories list
      const categories = await db
        .prepare(`
          SELECT id, name, description, color, createdAt, updatedAt
          FROM Category
          ORDER BY name ASC
        `)
        .all();

      return NextResponse.json(categories);
    }
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, color } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Category name is required" },
        { status: 400 }
      );
    }

    // Check if category already exists
    let env: any; try { env = getRequestContext().env; } catch { env = undefined; }
    const db = getDatabaseClient(env);

    const existingCategory = await db
      .prepare<{ id: string }>("SELECT id FROM Category WHERE name = ?")
      .get(name);

    if (existingCategory) {
      return NextResponse.json(
        { error: "Category with this name already exists" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const id = generateId();

    await db.prepare(
      `INSERT INTO Category (id, name, description, color, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, name, description ?? null, color ?? null, now, now);

    const newCategory = await db
      .prepare<{ id: string; name: string; description: string | null; color: string | null; createdAt: string; updatedAt: string }>(
        "SELECT id, name, description, color, createdAt, updatedAt FROM Category WHERE id = ?"
      )
      .get(id);

    return NextResponse.json(newCategory, { status: 201 });
  } catch (error) {
    console.error("Error creating category:", error);
    return NextResponse.json(
      { error: "Failed to create category" },
      { status: 500 }
    );
  }
}
