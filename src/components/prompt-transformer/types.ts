export interface PromptTransformerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    authorId: string | null;
    onPromptAdded: () => void;
}

export interface TransformResult {
    refinedPrompt: string;
    format: "markdown" | "json";
}

export interface TransformedPrompt {
    title: string;
    content: string;
    description?: string;
    targetModel?: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    notes?: string;
    tags?: string[];
    category?: string;
}

export type PromptProfile = "standard" | "chatgpt";

export interface ModeDefinition {
    id: string;
    label: string;
    description: string;
    category: "core" | "organization" | "practical";
}

export interface ModeSuggestion extends ModeDefinition {
    reason: string;
}

export interface ModeAnalyticsState {
    totalTransforms: number;
    modeCounts: Record<string, number>;
    lastModes: string[];
}
