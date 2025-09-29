import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";

type SupportedFormat = "markdown" | "json";

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
        { status: 400 }
      );
    }

    const zai = await ZAI.create();

    const prompt = `${systemPrompt}

Original text:
${inputText}

${format === "json" ? "Return the result in JSON format with a 'refinedPrompt' field." : "Return ONLY the refined prompt text in Markdown format."}`;

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are an expert prompt engineer specializing in transforming raw text into effective AI prompts.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    let refinedPrompt = completion.choices[0]?.message?.content?.trim() ?? "";

    if (format === "json") {
      try {
        const jsonMatch = refinedPrompt.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          refinedPrompt = JSON.stringify(parsed, null, 2);
        } else {
          refinedPrompt = JSON.stringify(
            {
              refinedPrompt,
              originalText: `${inputText.substring(0, 100)}...`,
              transformedAt: new Date().toISOString(),
            },
            null,
            2
          );
        }
      } catch (error) {
        console.error("Error parsing JSON response:", error);
        refinedPrompt = JSON.stringify(
          {
            refinedPrompt,
            originalText: `${inputText.substring(0, 100)}...`,
            transformedAt: new Date().toISOString(),
          },
          null,
          2
        );
      }
    }

    return NextResponse.json({
      refinedPrompt,
      format,
      success: true,
    });
  } catch (error) {
    console.error("Error in prompt transformation:", error);

    const previewText = inputText ? `${inputText.substring(0, 100)}...` : "No input provided.";
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
    });
  }
}
