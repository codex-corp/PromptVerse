import { NextResponse } from "next/server";

export const runtime = "edge";
export const revalidate = 0;

export async function GET() {
  return NextResponse.json({ message: "Good!" });
}
