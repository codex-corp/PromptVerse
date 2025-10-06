import { NextRequest, NextResponse } from "next/server";
import { getDatabaseFromRequest } from "@/lib/db";
import { generateId } from "@/lib/id";

interface RatingResponse {
  id: string;
  value: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  userId: string;
  user: { id: string; name: string };
}

export const runtime = "edge";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const promptId = searchParams.get("promptId");
    const userId = searchParams.get("userId");

    const db = getDatabaseFromRequest(request as any);

    if (promptId) {
      // Get ratings for a specific prompt
      const ratings = (await db
        .prepare(`
          SELECT r.id, r.value, r.comment, r.createdAt, r.updatedAt, r.userId,
                 json_object('id', u.id, 'name', u.name) as user
          FROM ratings r
          JOIN User u ON u.id = r.userId
          WHERE r.promptId = ?
          ORDER BY datetime(r.createdAt) DESC
        `)
        .all(promptId))
        .map((row: any) => ({
          id: row.id,
          value: row.value,
          comment: row.comment,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          userId: row.userId,
          user: JSON.parse(row.user),
        }));

      return NextResponse.json(ratings);
    } else if (userId) {
      // Get ratings by a specific user
      const ratings = (await db
        .prepare(`
          SELECT r.id, r.value, r.comment, r.createdAt, r.updatedAt, r.promptId,
                 json_object('id', p.id, 'title', p.title, 'targetModel', p.targetModel) as prompt
          FROM ratings r
          JOIN prompts p ON p.id = r.promptId
          WHERE r.userId = ?
          ORDER BY datetime(r.createdAt) DESC
        `)
        .all(userId))
        .map((row: any) => ({
          id: row.id,
          value: row.value,
          comment: row.comment,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          promptId: row.promptId,
          prompt: JSON.parse(row.prompt),
        }));

      return NextResponse.json(ratings);
    } else {
      return NextResponse.json(
        { error: "Either promptId or userId is required" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error fetching ratings:", error);
    return NextResponse.json(
      { error: "Failed to fetch ratings" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { promptId, userId, value, comment } = body;

    // Validate required fields
    if (!promptId || !userId || value === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: promptId, userId, value" },
        { status: 400 }
      );
    }

    // Validate rating value
    if (value < 1 || value > 5) {
      return NextResponse.json(
        { error: "Rating value must be between 1 and 5" },
        { status: 400 }
      );
    }

    // Check if prompt exists
    const db = getDatabaseFromRequest(request as any);

    const prompt = await db
      .prepare<{ id: string }>("SELECT id FROM prompts WHERE id = ?")
      .get(promptId);

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt not found" },
        { status: 404 }
      );
    }

    // Check if user has already rated this prompt
    const existingRating = await db
      .prepare<{
        id: string;
        userId: string;
        promptId: string;
        value: number;
        comment: string | null;
        createdAt: string;
        updatedAt: string;
      }>("SELECT * FROM ratings WHERE userId = ? AND promptId = ?")
      .get(userId, promptId);

    let rating: RatingResponse;

    if (existingRating) {
      // Update existing rating
      const updatedAt = new Date().toISOString();
      await db.prepare(
        `UPDATE ratings
         SET value = ?, comment = ?, updatedAt = ?
         WHERE id = ?`
      ).run(value, comment ?? existingRating.comment, updatedAt, existingRating.id);

      const updated = await db
        .prepare<{
          id: string;
          value: number;
          comment: string | null;
          createdAt: string;
          updatedAt: string;
          userId: string;
          user: string;
        }>(
          `
          SELECT r.id, r.value, r.comment, r.createdAt, r.updatedAt, r.userId,
                 json_object('id', u.id, 'name', u.name) as user
          FROM ratings r
          JOIN User u ON u.id = r.userId
          WHERE r.id = ?
        `
        )
        .get(existingRating.id);

      if (!updated) {
        throw new Error("Updated rating not found");
      }

      const parsedUser = JSON.parse(updated.user) as { id: string; name: string };

      rating = {
        id: updated.id,
        value: updated.value,
        comment: updated.comment,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        userId: existingRating.userId,
        user: parsedUser,
      };
    } else {
      // Create new rating
      const id = generateId();
      const timestamp = new Date().toISOString();

      await db.prepare(
        `INSERT INTO ratings (id, promptId, userId, value, comment, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(id, promptId, userId, value, comment ?? null, timestamp, timestamp);

      const inserted = await db
        .prepare<{
          id: string;
          value: number;
          comment: string | null;
          createdAt: string;
          updatedAt: string;
          user: string;
        }>(
          `
          SELECT r.id, r.value, r.comment, r.createdAt, r.updatedAt,
                 json_object('id', u.id, 'name', u.name) as user
          FROM ratings r
          JOIN User u ON u.id = r.userId
          WHERE r.id = ?
        `
        )
        .get(id);

      if (!inserted) {
        throw new Error("Inserted rating not found");
      }

      const parsedUser = JSON.parse(inserted.user) as { id: string; name: string };

      rating = {
        id: inserted.id,
        value: inserted.value,
        comment: inserted.comment,
        createdAt: inserted.createdAt,
        updatedAt: inserted.updatedAt,
        userId,
        user: parsedUser,
      };
    }

    return NextResponse.json(rating);
  } catch (error) {
    console.error("Error creating/updating rating:", error);
    return NextResponse.json(
      { error: "Failed to create/update rating" },
      { status: 500 }
    );
  }
}
