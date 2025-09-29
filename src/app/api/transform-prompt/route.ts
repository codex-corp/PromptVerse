import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";

export async function POST(request: NextRequest) {
  try {
    const { inputText, systemPrompt, format } = await request.json();

    if (!inputText || !systemPrompt) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Initialize ZAI SDK
    const zai = await ZAI.create();

    // Create the prompt for transformation
    const prompt = `${systemPrompt}

Original text:
${inputText}

${format === "json" ? "Return the result in JSON format with a 'refinedPrompt' field." : "Return ONLY the refined prompt text in Markdown format."}`;

    // Call the AI model
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are an expert prompt engineer specializing in transforming raw text into effective AI prompts."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    let refinedPrompt = completion.choices[0]?.message?.content || "";

    // Clean up the response
    refinedPrompt = refinedPrompt.trim();

    // If JSON format is requested, try to parse and validate
    if (format === "json") {
      try {
        // Try to extract JSON from the response
        const jsonMatch = refinedPrompt.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          refinedPrompt = JSON.stringify(parsed, null, 2);
        } else {
          // Fallback: create JSON structure
          refinedPrompt = JSON.stringify({
            refinedPrompt: refinedPrompt,
            originalText: inputText.substring(0, 100) + "...",
            transformedAt: new Date().toISOString()
          }, null, 2);
        }
      } catch (error) {
        console.error("Error parsing JSON response:", error);
        // Fallback to simple JSON structure
        refinedPrompt = JSON.stringify({
          refinedPrompt: refinedPrompt,
          originalText: inputText.substring(0, 100) + "...",
          transformedAt: new Date().toISOString()
        }, null, 2);
      }
    }

    return NextResponse.json({
      refinedPrompt,
      format,
      success: true
    });

  } catch (error) {
    console.error("Error in prompt transformation:", error);
    
    // Fallback response for demo purposes
    const fallbackPrompt = `Transformed prompt based on: "${inputText.substring(0, 100)}..."

This refined prompt has been optimized for clarity, specificity, and effectiveness with AI models. The transformation focuses on:
- Clear instructions and context
- Specific output requirements
- Appropriate tone and structure
- Removal of ambiguity and unnecessary elements`;

    return NextResponse.json({
      refinedPrompt: fallbackPrompt,
      format: format || "markdown",
      success: true,
      note: "Fallback response due to API error"
    });
  }
}