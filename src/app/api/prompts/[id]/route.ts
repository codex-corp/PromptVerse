import { NextRequest, NextResponse } from "next/server";
import { getDatabaseClient } from "@/lib/db";
import { getRequestContext } from "@cloudflare/next-on-pages";
import {
  deletePrompt,
  fetchPromptById,
  updatePrompt,
} from "@/lib/prompt-repository";

export const runtime = process.env.NEXT_RUNTIME === "edge" ? "edge" : "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    let env: any; try { env = getRequestContext().env; } catch { env = undefined; }
    const db = getDatabaseClient(env);
    const prompt = await fetchPromptById(id, db);

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(prompt);
  } catch (error) {
    console.error("Error fetching prompt:", error);
    return NextResponse.json(
      { error: "Failed to fetch prompt" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
      categoryId,
      tags,
      isFavorite,
      viewCount,
    } = body;

    let env: any; try { env = getRequestContext().env; } catch { env = undefined; }
    const db = getDatabaseClient(env);
    const updated = await updatePrompt(id, {
      title,
      content,
      description,
      targetModel,
      temperature: temperature !== undefined && temperature !== null ? parseFloat(temperature) : undefined,
      maxTokens: maxTokens !== undefined && maxTokens !== null ? parseInt(maxTokens, 10) : undefined,
      topP: topP !== undefined && topP !== null ? parseFloat(topP) : undefined,
      frequencyPenalty:
        frequencyPenalty !== undefined && frequencyPenalty !== null
          ? parseFloat(frequencyPenalty)
          : undefined,
      presencePenalty:
        presencePenalty !== undefined && presencePenalty !== null
          ? parseFloat(presencePenalty)
          : undefined,
      notes,
      categoryId,
      tags,
      isFavorite,
      viewCount: viewCount !== undefined && viewCount !== null ? parseInt(viewCount, 10) : undefined,
    }, db);

    if (!updated) {
      return NextResponse.json(
        { error: "Prompt not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating prompt:", error);
    return NextResponse.json(
      { error: "Failed to update prompt" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    let env: any; try { env = getRequestContext().env; } catch { env = undefined; }
    const db = getDatabaseClient(env);
    const removed = await deletePrompt(id, db);

    if (!removed) {
      return NextResponse.json(
        { error: "Prompt not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "Prompt deleted successfully" });
  } catch (error) {
    console.error("Error deleting prompt:", error);
    return NextResponse.json(
      { error: "Failed to delete prompt" },
      { status: 500 }
    );
  }
}
