import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeCounts = searchParams.get("includeCounts") === "true";

    if (includeCounts) {
      // Get categories with prompt counts
      const categories = await db.category.findMany({
        include: {
          _count: {
            select: {
              prompts: true
            }
          }
        },
        orderBy: {
          name: "asc"
        }
      });

      const totalPrompts = await db.prompt.count();

      const categoriesWithCounts = categories.map(category => ({
        ...category,
        count: category._count.prompts
      }));

      return NextResponse.json({
        categories: categoriesWithCounts,
        total: totalPrompts
      });
    } else {
      // Get simple categories list
      const categories = await db.category.findMany({
        orderBy: {
          name: "asc"
        }
      });

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
    const existingCategory = await db.category.findUnique({
      where: { name }
    });

    if (existingCategory) {
      return NextResponse.json(
        { error: "Category with this name already exists" },
        { status: 400 }
      );
    }

    const newCategory = await db.category.create({
      data: {
        name,
        description,
        color
      }
    });

    return NextResponse.json(newCategory, { status: 201 });
  } catch (error) {
    console.error("Error creating category:", error);
    return NextResponse.json(
      { error: "Failed to create category" },
      { status: 500 }
    );
  }
}