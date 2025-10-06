import { NextRequest, NextResponse } from "next/server";
import { getDatabaseClient } from "@/lib/db";
import { getRequestContext } from "@cloudflare/next-on-pages";
import { generateId } from "@/lib/id";


export const runtime = "edge";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeCounts = searchParams.get("includeCounts") === "true";
    const search = searchParams.get("search") || "";

    let env: any; try { env = getRequestContext().env; } catch { env = undefined; }

    const db = getDatabaseClient(env);

    if (includeCounts) {
      // Get tags with prompt counts
      const tags = await db
        .prepare(`
          SELECT t.id, t.name, t.color, t.createdAt, t.updatedAt,
                 COUNT(pt.id) AS count
          FROM Tag t
          LEFT JOIN prompt_tags pt ON pt.tagId = t.id
          WHERE (? = '' OR t.name LIKE ?)
          GROUP BY t.id
          ORDER BY count DESC, t.name ASC
        `)
        .all(search, `%${search}%`);

      return NextResponse.json(tags);
    } else {
      // Get simple tags list
      const tags = await db
        .prepare(`
          SELECT id, name, color, createdAt, updatedAt
          FROM Tag
          WHERE (? = '' OR name LIKE ?)
          ORDER BY name ASC
        `)
        .all(search, `%${search}%`);

      return NextResponse.json(tags);
    }
  } catch (error) {
    console.error("Error fetching tags:", error);
    return NextResponse.json(
      { error: "Failed to fetch tags" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, color } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Tag name is required" },
        { status: 400 }
      );
    }

    // Check if tag already exists
    let env: any; try { env = getRequestContext().env; } catch { env = undefined; }

    const db = getDatabaseClient(env);

    const existingTag = await db
      .prepare<{ id: string }>("SELECT id FROM Tag WHERE name = ?")
      .get(name);

    if (existingTag) {
      return NextResponse.json(
        { error: "Tag with this name already exists" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const id = generateId();

    await db.prepare(
      `INSERT INTO Tag (id, name, color, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?)`
    ).run(id, name, color ?? null, now, now);

    const newTag = await db
      .prepare<{ id: string; name: string; color: string | null; createdAt: string; updatedAt: string }>(
        "SELECT id, name, color, createdAt, updatedAt FROM Tag WHERE id = ?"
      )
      .get(id);

    return NextResponse.json(newTag, { status: 201 });
  } catch (error) {
    console.error("Error creating tag:", error);
    return NextResponse.json(
      { error: "Failed to create tag" },
      { status: 500 }
    );
  }
}
