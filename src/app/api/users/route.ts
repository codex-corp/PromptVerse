import { NextRequest, NextResponse } from "next/server";
import { getDatabaseFromRequest } from "@/lib/db";


export const runtime = "edge";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Math.max(1, parseInt(limitParam, 10)) : undefined;

    const baseQuery = `
      SELECT id, name, email
      FROM User
      ORDER BY datetime(createdAt) ASC
    `;

    const db = getDatabaseFromRequest(request as any);
    const stmt = limit
      ? db.prepare(`${baseQuery} LIMIT ?`)
      : db.prepare(baseQuery);

    const users = limit ? await stmt.all(limit) : await stmt.all();

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
