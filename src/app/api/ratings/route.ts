import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const promptId = searchParams.get("promptId");
    const userId = searchParams.get("userId");

    if (promptId) {
      // Get ratings for a specific prompt
      const ratings = await db.rating.findMany({
        where: { promptId },
        include: {
          user: {
            select: { id: true, name: true }
          }
        },
        orderBy: {
          createdAt: "desc"
        }
      });

      return NextResponse.json(ratings);
    } else if (userId) {
      // Get ratings by a specific user
      const ratings = await db.rating.findMany({
        where: { userId },
        include: {
          prompt: {
            select: { id: true, title, targetModel }
          }
        },
        orderBy: {
          createdAt: "desc"
        }
      });

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
    const prompt = await db.prompt.findUnique({
      where: { id: promptId }
    });

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt not found" },
        { status: 404 }
      );
    }

    // Check if user has already rated this prompt
    const existingRating = await db.rating.findFirst({
      where: {
        userId,
        promptId
      }
    });

    let rating;

    if (existingRating) {
      // Update existing rating
      rating = await db.rating.update({
        where: { id: existingRating.id },
        data: {
          value,
          comment: comment ?? existingRating.comment
        },
        include: {
          user: {
            select: { id: true, name: true }
          }
        }
      });
    } else {
      // Create new rating
      rating = await db.rating.create({
        data: {
          promptId,
          userId,
          value,
          comment
        },
        include: {
          user: {
            select: { id: true, name: true }
          }
        }
      });
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