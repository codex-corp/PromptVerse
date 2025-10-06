import { NextRequest, NextResponse } from "next/server";
import { getDatabaseClient } from "@/lib/db";
import { getRequestContext } from "@cloudflare/next-on-pages";
import {
  createPrompt,
  fetchPrompts,
  PromptFilterOptions,
} from "@/lib/prompt-repository";
import { generateId } from "@/lib/id";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Extract query parameters
    const search = searchParams.get("search") || "";
    const categories = searchParams.get("categories")?.split(",").filter(Boolean) || [];
    const tags = searchParams.get("tags")?.split(",").filter(Boolean) || [];
    const targetModels = searchParams.get("models")?.split(",").filter(Boolean) || [];
    const rating = searchParams.get("rating") ? parseInt(searchParams.get("rating")!) : null;
    const isFavorite = searchParams.get("favorite") === "true" ? true :
                      searchParams.get("favorite") === "false" ? false : null;
    const dateRange = searchParams.get("dateRange") || "all";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    // Build where clause for filtering
    const options: PromptFilterOptions = {
      search,
      categories,
      tags,
      targetModels,
      rating,
      isFavorite,
      dateRange: dateRange as PromptFilterOptions["dateRange"],
      page,
      limit,
      sortBy,
      sortOrder: sortOrder as PromptFilterOptions["sortOrder"],
    };

    let env: any; try { env = getRequestContext().env; } catch { env = undefined; }
    const db = getDatabaseClient(env);
    const result = await fetchPrompts(options, db);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching prompts:", error);
    return NextResponse.json(
      { error: "Failed to fetch prompts" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title,
      content,
      description,
      targetModel,
      temperature,
      maxTokens,
      topP,
      frequencyPenalty,
      presencePenalty,
      notes,
      category,
      tags,
      authorId
    } = body;

    // Validate required fields
    if (!title || !content || !targetModel || !authorId) {
      return NextResponse.json(
        { error: "Missing required fields: title, content, targetModel, authorId" },
        { status: 400 }
      );
    }

    let env: any; try { env = getRequestContext().env; } catch { env = undefined; }
    const db = getDatabaseClient(env);

    const author = await db
      .prepare<{ id: string }>("SELECT id FROM User WHERE id = ?")
      .get(authorId);

    if (!author) {
      return NextResponse.json(
        { error: "Author not found" },
        { status: 404 }
      );
    }

    let categoryId: string | null = null;
    if (category) {
      const categoryRow = await db
        .prepare<{ id: string }>("SELECT id FROM Category WHERE name = ?")
        .get(category);
      if (categoryRow) {
        categoryId = categoryRow.id;
      } else {
        const newCategoryId = generateId();
        const now = new Date().toISOString();
        await db
          .prepare(
            "INSERT INTO Category (id, name, createdAt, updatedAt) VALUES (?, ?, ?, ?)"
          )
          .run(newCategoryId, category, now, now);
        categoryId = newCategoryId;
      }
    }

    const created = await createPrompt({
      title,
      content,
      description,
      targetModel,
      temperature: temperature ? parseFloat(temperature) : null,
      maxTokens: maxTokens ? parseInt(maxTokens, 10) : null,
      topP: topP ? parseFloat(topP) : null,
      frequencyPenalty: frequencyPenalty ? parseFloat(frequencyPenalty) : null,
      presencePenalty: presencePenalty ? parseFloat(presencePenalty) : null,
      notes,
      categoryId,
      authorId,
      tags,
    }, db);

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Error creating prompt:", error);
    return NextResponse.json(
      { error: "Failed to create prompt" },
      { status: 500 }
    );
  }
}
