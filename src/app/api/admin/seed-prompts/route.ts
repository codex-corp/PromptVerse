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
    const result = await seedPrompts(db);
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Failed to seed prompts (admin endpoint):", error);
    return NextResponse.json({ error: "Failed to seed prompts" }, { status: 500 });
  }
}
