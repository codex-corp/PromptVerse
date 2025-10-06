import { NextResponse } from "next/server";

export const revalidate = 0;

export const runtime = process.env.NEXT_RUNTIME === "edge" ? "edge" : "nodejs";

export async function GET() {
  return NextResponse.json({ message: "Good!" });
}
