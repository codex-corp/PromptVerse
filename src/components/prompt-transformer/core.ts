import type { TransformMetadata, TransformResult } from "./types";

export type TransformFormat = "markdown" | "json";

export interface TransformRequestPayload {
    inputText: string;
    systemPrompt: string;
    format: TransformFormat;
    signal?: AbortSignal;
    endpoint?: string;
}

export interface TransformServiceResponse {
    refinedPrompt: string;
    format: TransformFormat;
    metadata?: unknown;
    note?: string;
    success?: boolean;
}

export const DEFAULT_TRANSFORM_ENDPOINT = "/api/transform-prompt";

export function parseTransformMetadata(metadata: unknown): TransformMetadata | null {
    if (!metadata || typeof metadata !== "object") {
        return null;
    }

    const value = metadata as Record<string, unknown>;

    return {
        estimatedTokens: typeof value.estimatedTokens === "number" ? value.estimatedTokens : null,
        complexity: typeof value.complexity === "string" ? value.complexity : null,
        chainOfThought: typeof value.chainOfThought === "string" ? value.chainOfThought : null,
    };
}

export function estimateTokenCount(content: string): number {
    if (!content) {
        return 0;
    }

    return Math.ceil(content.length / 4);
}

export function deriveComplexity(estimatedTokens: number): "Low" | "Medium" | "High" {
    if (estimatedTokens > 1200) {
        return "High";
    }

    if (estimatedTokens > 400) {
        return "Medium";
    }

    return "Low";
}

export function buildTransformMetadata(content: string): TransformMetadata {
    const estimatedTokens = estimateTokenCount(content);

    return {
        estimatedTokens,
        complexity: deriveComplexity(estimatedTokens),
        chainOfThought: null,
    };
}

export function buildFallbackPromptPreview(inputText: string): string {
    if (!inputText) {
        return "No input provided.";
    }

    return `${inputText.substring(0, 100)}...`;
}

export async function executeTransformRequest({
    inputText,
    systemPrompt,
    format,
    signal,
    endpoint = DEFAULT_TRANSFORM_ENDPOINT,
}: TransformRequestPayload): Promise<TransformResult> {
    const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputText, systemPrompt, format }),
        signal,
    });

    if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || "Failed to transform prompt");
    }

    const data = (await response.json()) as TransformServiceResponse;
    const metadata = parseTransformMetadata(data.metadata);

    return {
        refinedPrompt: data.refinedPrompt,
        format: data.format ?? format,
        metadata,
    };
}
