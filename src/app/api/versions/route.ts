import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      originalPromptId,
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
      versionNote,
      authorId
    } = body;

    // Validate required fields
    if (!originalPromptId || !title || !content || !targetModel || !authorId) {
      return NextResponse.json(
        { error: "Missing required fields: originalPromptId, title, content, targetModel, authorId" },
        { status: 400 }
      );
    }

    // Check if original prompt exists
    const originalPrompt = await db.prompt.findUnique({
      where: { id: originalPromptId },
      include: {
        author: {
          select: { id: true, name: true }
        }
      }
    });

    if (!originalPrompt) {
      return NextResponse.json(
        { error: "Original prompt not found" },
        { status: 404 }
      );
    }

    // Create the new version
    const newVersion = await db.promptVersion.create({
      data: {
        title,
        content,
        description,
        targetModel,
        temperature: temperature ? parseFloat(temperature) : null,
        maxTokens: maxTokens ? parseInt(maxTokens) : null,
        topP: topP ? parseFloat(topP) : null,
        frequencyPenalty: frequencyPenalty ? parseFloat(frequencyPenalty) : null,
        presencePenalty: presencePenalty ? parseFloat(presencePenalty) : null,
        notes,
        versionNote: versionNote || "Cloned version",
        originalPromptId
      }
    });

    return NextResponse.json(newVersion, { status: 201 });
  } catch (error) {
    console.error("Error creating version:", error);
    return NextResponse.json(
      { error: "Failed to create version" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const originalPromptId = searchParams.get("originalPromptId");

    if (originalPromptId) {
      // Get versions for a specific prompt
      const versions = await db.promptVersion.findMany({
        where: { originalPromptId },
        include: {
          originalPrompt: {
            select: { id: true, title }
          }
        },
        orderBy: {
          createdAt: "desc"
        }
      });

      return NextResponse.json(versions);
    } else {
      return NextResponse.json(
        { error: "originalPromptId is required" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error fetching versions:", error);
    return NextResponse.json(
      { error: "Failed to fetch versions" },
      { status: 500 }
    );
  }
}