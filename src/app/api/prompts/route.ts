import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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
    const where: any = {};
    
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { content: { contains: search } },
        { description: { contains: search } },
      ];
    }
    
    if (categories.length > 0) {
      where.categoryId = { in: categories };
    }
    
    if (tags.length > 0) {
      where.tags = {
        some: {
          tag: {
            name: { in: tags }
          }
        }
      };
    }
    
    if (targetModels.length > 0) {
      where.targetModel = { in: targetModels };
    }
    
    if (rating !== null) {
      where.ratings = {
        some: {
          value: { gte: rating }
        }
      };
    }
    
    if (isFavorite !== null) {
      where.isFavorite = isFavorite;
    }
    
    // Date range filtering
    if (dateRange !== "all") {
      const now = new Date();
      let startDate = new Date();
      
      switch (dateRange) {
        case "today":
          startDate.setHours(0, 0, 0, 0);
          break;
        case "week":
          startDate.setDate(now.getDate() - 7);
          break;
        case "month":
          startDate.setMonth(now.getMonth() - 1);
          break;
        case "year":
          startDate.setFullYear(now.getFullYear() - 1);
          break;
      }
      
      where.createdAt = { gte: startDate };
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Build order by clause
    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    // Fetch prompts with related data
    const [prompts, totalCount] = await Promise.all([
      db.prompt.findMany({
        where,
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
            select: { id: true, value: true, comment: true, createdAt: true, userId: true }
          },
          versions: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { id: true, versionNote: true, createdAt: true }
          },
          _count: {
            select: {
              ratings: true,
              versions: true
            }
          }
        },
        orderBy,
        skip,
        take: limit
      }),
      db.prompt.count({ where })
    ]);

    // Calculate average rating for each prompt
    const promptsWithRatings = prompts.map(prompt => {
      const ratings = prompt.ratings.map(r => r.value);
      const averageRating = ratings.length > 0 
        ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length 
        : 0;
      
      return {
        ...prompt,
        averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
        totalRatings: ratings.length,
        userRating: prompt.ratings.find(r => r.userId)?.value || null
      };
    });

    return NextResponse.json({
      prompts: promptsWithRatings,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
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
      categoryId,
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

    // Create the prompt
    const newPrompt = await db.prompt.create({
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
        categoryId,
        authorId,
        tags: tags ? {
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

    // Create initial version
    await db.promptVersion.create({
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
        versionNote: "Initial version",
        originalPromptId: newPrompt.id
      }
    });

    return NextResponse.json(newPrompt, { status: 201 });
  } catch (error) {
    console.error("Error creating prompt:", error);
    return NextResponse.json(
      { error: "Failed to create prompt" },
      { status: 500 }
    );
  }
}