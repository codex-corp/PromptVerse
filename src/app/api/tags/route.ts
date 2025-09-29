import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeCounts = searchParams.get("includeCounts") === "true";
    const search = searchParams.get("search") || "";

    const where = search
      ? {
          name: {
            contains: search,
            mode: "insensitive" as const
          }
        }
      : {};

    if (includeCounts) {
      // Get tags with prompt counts
      const tags = await db.tag.findMany({
        where,
        include: {
          _count: {
            select: {
              prompts: true
            }
          }
        },
        orderBy: [
          {
            prompts: {
              _count: "desc"
            }
          },
          {
            name: "asc"
          }
        ]
      });

      const tagsWithCounts = tags.map(tag => ({
        ...tag,
        count: tag._count.prompts
      }));

      return NextResponse.json(tagsWithCounts);
    } else {
      // Get simple tags list
      const tags = await db.tag.findMany({
        where,
        orderBy: {
          name: "asc"
        }
      });

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
    const existingTag = await db.tag.findUnique({
      where: { name }
    });

    if (existingTag) {
      return NextResponse.json(
        { error: "Tag with this name already exists" },
        { status: 400 }
      );
    }

    const newTag = await db.tag.create({
      data: {
        name,
        color
      }
    });

    return NextResponse.json(newTag, { status: 201 });
  } catch (error) {
    console.error("Error creating tag:", error);
    return NextResponse.json(
      { error: "Failed to create tag" },
      { status: 500 }
    );
  }
}