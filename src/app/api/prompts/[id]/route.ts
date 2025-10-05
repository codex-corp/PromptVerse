import { NextRequest, NextResponse } from "next/server";
import {
  deletePrompt,
  fetchPromptById,
  updatePrompt,
} from "@/lib/prompt-repository";

type RouteContext = {
  params: { id: string } | Promise<{ id: string }>;
};

async function resolveId(params: RouteContext["params"]) {
  const resolved = await Promise.resolve(params);
  return resolved.id;
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const id = await resolveId(context.params);

    const prompt = fetchPromptById(id);

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
  context: RouteContext
) {
  try {
    const id = await resolveId(context.params);
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

    const updated = updatePrompt(id, {
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
    });

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
  context: RouteContext
) {
  try {
    const id = await resolveId(context.params);

    const removed = deletePrompt(id);

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
