import { NextRequest, NextResponse } from "next/server";
import { getDatabaseFromRequest } from "@/lib/db";
import { seedPrompts } from "@/lib/seed-prompts";
import { getRequestContext } from "@cloudflare/next-on-pages";

export const runtime = "edge";

function resolveSeedToken(): string | undefined {
  try {
    const envToken = getRequestContext().env?.ADMIN_SEED_TOKEN;
    if (typeof envToken === "string" && envToken.length > 0) {
      return envToken;
    }
  } catch {
    // ignore when not on Cloudflare runtime
  }

  if (typeof process !== "undefined" && process.env?.ADMIN_SEED_TOKEN) {
    return process.env.ADMIN_SEED_TOKEN;
  }

  return undefined;
}

export async function POST(request: NextRequest) {
  const secret = resolveSeedToken();
  if (!secret) {
    return NextResponse.json({ error: "Seed token is not configured." }, { status: 500 });
  }

  const headerToken = request.headers.get("x-seed-token")
    ?? request.headers.get("authorization")
    ?? "";

  const normalizedHeader = headerToken.startsWith("Bearer ")
    ? headerToken.slice(7).trim()
    : headerToken.trim();

  if (normalizedHeader !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDatabaseFromRequest(request);
    let env: Record<string, string> = {};

    try {
      env = (getRequestContext().env as Record<string, string>) ?? {};
    } catch {
      env = {};
    }

    const result = await seedPrompts(db, {
      csvUrl: env.SEED_PROMPTS_URL,
      authorEmail: env.SEED_USER_EMAIL,
      authorName: env.SEED_USER_NAME,
      defaultModel: env.SEED_DEFAULT_MODEL,
      engineeringCategoryName: env.SEED_PROMPTS_ENGINEERING_CATEGORY,
      engineeringCategoryDescription: env.SEED_PROMPTS_ENGINEERING_DESCRIPTION,
      engineeringCategoryColor: env.SEED_PROMPTS_ENGINEERING_COLOR,
      generalCategoryName: env.SEED_PROMPTS_GENERAL_CATEGORY,
      generalCategoryDescription: env.SEED_PROMPTS_GENERAL_DESCRIPTION,
      generalCategoryColor: env.SEED_PROMPTS_GENERAL_COLOR,
    });
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Failed to seed prompts (admin endpoint):", error);
    return NextResponse.json({ error: "Failed to seed prompts" }, { status: 500 });
  }
}
