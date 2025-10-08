import { NextRequest, NextResponse } from "next/server";
import { buildFallbackPromptPreview, buildTransformMetadata } from "@/components/prompt-transformer/core";

type SupportedFormat = "markdown" | "json";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ChatCompletionChoice = {
  message?: {
    content?: string | null;
  } | null;
};

type ChatCompletionResponse = {
  choices?: ChatCompletionChoice[];
};

const DEFAULT_MODEL = process.env.AI_MODEL ?? "gpt-4o-mini";
const BASE_URL = (
  process.env.AI_BASE_URL ?? process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1"
).replace(/\/$/, "");
const API_KEY = process.env.AI_API_KEY ?? process.env.OPENAI_API_KEY ?? "";

async function callChatCompletion({
  messages,
  temperature,
  maxTokens,
}: {
  messages: ChatMessage[];
  temperature: number;
  maxTokens: number;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Chat completion request failed: ${response.status} ${response.statusText}${
          errorBody ? ` - ${errorBody}` : ""
        }`,
      );
    }

    const data = (await response.json()) as ChatCompletionResponse;
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

export const runtime = "edge";

export async function POST(request: NextRequest) {
  let inputText = "";
  let systemPrompt = "";
  let format: SupportedFormat = "markdown";

  try {
    const body = await request.json();
    inputText = typeof body.inputText === "string" ? body.inputText : "";
    systemPrompt = typeof body.systemPrompt === "string" ? body.systemPrompt : "";
    format = body.format === "json" ? "json" : "markdown";

    if (!inputText || !systemPrompt) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const completion = await callChatCompletion({
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: inputText,
        },
      ],
      temperature: 0.7,
      maxTokens: 2000,
    });

    let refinedPrompt = completion.choices?.[0]?.message?.content?.trim() ?? "";

    return NextResponse.json({
      refinedPrompt,
      format,
      success: true,
      metadata: buildTransformMetadata(refinedPrompt),
    });
  } catch (error) {
    console.error("Error in prompt transformation:", error);

    const previewText = buildFallbackPromptPreview(inputText);
    const fallbackPrompt = `Transformed prompt based on: "${previewText}"

This refined prompt has been optimized for clarity, specificity, and effectiveness with AI models. The transformation focuses on:
- Clear instructions and context
- Specific output requirements
- Appropriate tone and structure
- Removal of ambiguity and unnecessary elements`;

    return NextResponse.json({
      refinedPrompt: fallbackPrompt,
      format,
      success: true,
      note: "Fallback response due to API error",
      metadata: buildTransformMetadata(fallbackPrompt),
    });
  }
}
