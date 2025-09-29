import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const prompt = await db.prompt.findUnique({
      where: { id },
      include: {
        author: {
          select: { id: true, name: true, email: true }
        },
        category: {
          select: { id: true, name: true, color: true }
        },
        tags: {
          include: {
            tag: {
              select: { id: true, name: true, color: true }
            }
          }
        },
        ratings: {
          include: {
            user: {
              select: { id: true, name: true }
            }
          },
          orderBy: { createdAt: "desc" }
        },
        versions: {
          orderBy: { createdAt: "desc" },
          include: {
            originalPrompt: {
              select: { id: true, title }
            }
          }
        }
      }
    });

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt not found" },
        { status: 404 }
      );
    }

    // Calculate average rating
    const ratings = prompt.ratings.map(r => r.value);
    const averageRating = ratings.length > 0 
      ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length 
      : 0;

    return NextResponse.json({
      ...prompt,
      averageRating: Math.round(averageRating * 10) / 10,
      totalRatings: ratings.length
    });
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
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
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
      isFavorite
    } = body;

    // Check if prompt exists
    const existingPrompt = await db.prompt.findUnique({
      where: { id },
      include: { tags: true }
    });

    if (!existingPrompt) {
      return NextResponse.json(
        { error: "Prompt not found" },
        { status: 404 }
      );
    }

    // Update the prompt
    const updatedPrompt = await db.prompt.update({
      where: { id },
      data: {
        title: title ?? existingPrompt.title,
        content: content ?? existingPrompt.content,
        description: description ?? existingPrompt.description,
        targetModel: targetModel ?? existingPrompt.targetModel,
        temperature: temperature !== undefined ? parseFloat(temperature) : existingPrompt.temperature,
        maxTokens: maxTokens !== undefined ? parseInt(maxTokens) : existingPrompt.maxTokens,
        topP: topP !== undefined ? parseFloat(topP) : existingPrompt.topP,
        frequencyPenalty: frequencyPenalty !== undefined ? parseFloat(frequencyPenalty) : existingPrompt.frequencyPenalty,
        presencePenalty: presencePenalty !== undefined ? parseFloat(presencePenalty) : existingPrompt.presencePenalty,
        notes: notes ?? existingPrompt.notes,
        categoryId: categoryId ?? existingPrompt.categoryId,
        isFavorite: isFavorite ?? existingPrompt.isFavorite,
        tags: tags ? {
          // Remove existing tags
          deleteMany: {},
          // Add new tags
          create: tags.map((tagName: string) => ({
            tag: {
              connectOrCreate: {
                where: { name: tagName },
                create: { name: tagName }
              }
            }
          }))
        } : undefined
      },
      include: {
        author: {
          select: { id: true, name: true, email: true }
        },
        category: {
          select: { id: true, name: true, color: true }
        },
        tags: {
          include: {
            tag: {
              select: { id: true, name: true, color: true }
            }
          }
        }
      }
    });

    // Create a new version if significant changes were made
    const significantChanges = 
      title !== existingPrompt.title ||
      content !== existingPrompt.content ||
      description !== existingPrompt.description ||
      targetModel !== existingPrompt.targetModel;

    if (significantChanges) {
      await db.promptVersion.create({
        data: {
          title: updatedPrompt.title,
          content: updatedPrompt.content,
          description: updatedPrompt.description,
          targetModel: updatedPrompt.targetModel,
          temperature: updatedPrompt.temperature,
          maxTokens: updatedPrompt.maxTokens,
          topP: updatedPrompt.topP,
          frequencyPenalty: updatedPrompt.frequencyPenalty,
          presencePenalty: updatedPrompt.presencePenalty,
          notes: updatedPrompt.notes,
          versionNote: "Updated prompt",
          originalPromptId: id
        }
      });
    }

    return NextResponse.json(updatedPrompt);
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
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Check if prompt exists
    const existingPrompt = await db.prompt.findUnique({
      where: { id }
    });

    if (!existingPrompt) {
      return NextResponse.json(
        { error: "Prompt not found" },
        { status: 404 }
      );
    }

    // Delete the prompt (cascade will handle related records)
    await db.prompt.delete({
      where: { id }
    });

    return NextResponse.json({ message: "Prompt deleted successfully" });
  } catch (error) {
    console.error("Error deleting prompt:", error);
    return NextResponse.json(
      { error: "Failed to delete prompt" },
      { status: 500 }
    );
  }
}