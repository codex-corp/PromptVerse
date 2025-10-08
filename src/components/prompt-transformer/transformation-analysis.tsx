"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { TransformMetadata } from "./types";
import { Brain, Sparkles } from "lucide-react";
import { useMemo } from "react";

interface TransformationAnalysisProps {
    metadata: TransformMetadata;
    onBackToTemplates?: () => void;
}

const COMPLEXITY_STYLES: Record<"low" | "medium" | "high", string> = {
    low: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
    medium: "border-amber-500/40 bg-amber-500/10 text-amber-500",
    high: "border-red-500/40 bg-red-500/10 text-red-500",
};

const DEFAULT_COMPLEXITY_CLASS = "border-border/50 bg-muted/40 text-muted-foreground";

const formatEstimatedTokens = (value: number | null) => {
    if (typeof value !== "number" || Number.isNaN(value)) {
        return "Unknown";
    }

    if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}k`;
    }

    return value.toString();
};

export function TransformationAnalysis({ metadata, onBackToTemplates }: TransformationAnalysisProps) {
    const complexity = useMemo(() => {
        const normalized = metadata.complexity?.toLowerCase() as "low" | "medium" | "high" | undefined;
        if (!normalized) {
            return {
                label: "Complexity Unknown",
                className: DEFAULT_COMPLEXITY_CLASS,
            };
        }

        if (normalized in COMPLEXITY_STYLES) {
            const label = `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)} Complexity`;
            return {
                label,
                className: COMPLEXITY_STYLES[normalized],
            };
        }

        return {
            label: "Complexity Unknown",
            className: DEFAULT_COMPLEXITY_CLASS,
        };
    }, [metadata.complexity]);

    const estimatedTokensLabel = useMemo(
        () => formatEstimatedTokens(metadata.estimatedTokens ?? null),
        [metadata.estimatedTokens]
    );

    const reasoning = metadata.chainOfThought?.trim();

    return (
        <div className="flex h-full flex-col rounded-2xl border bg-card shadow-sm">
            <div className="flex items-start justify-between gap-2 border-b px-5 py-4">
                <div>
                    <p className="flex items-center gap-2 text-sm font-medium tracking-tight">
                        <Sparkles className="h-4 w-4 text-primary" /> Transformation Analysis
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Final assessment of the prompt engineering pass, including effort and rationale.
                    </p>
                </div>
                <Badge
                    variant="outline"
                    className={cn("text-[10px] uppercase tracking-wide", complexity.className)}
                >
                    {complexity.label}
                </Badge>
            </div>

            <div className="flex flex-1 flex-col gap-4 px-5 py-4 overflow-hidden">
                <div className="grid gap-3 rounded-xl border border-border/60 bg-background/40 p-4">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                        <Brain className="h-4 w-4 text-primary" /> Estimated Tokens
                    </div>
                    <p className="text-2xl font-semibold text-foreground">{estimatedTokensLabel}</p>
                    <p className="text-xs text-muted-foreground">
                        Estimated combined tokens required to deliver this refined instruction set.
                    </p>
                </div>

                <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border/60 bg-background/40">
                    <div className="border-b px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Analyst’s Reasoning
                        </p>
                    </div>
                    <ScrollArea className="flex-1 px-4 py-3">
                        {reasoning ? (
                            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                                {reasoning}
                            </p>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                No reasoning details were provided for this transform.
                            </p>
                        )}
                    </ScrollArea>
                </div>
            </div>

            {onBackToTemplates && (
                <div className="border-t bg-muted/40 px-5 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={onBackToTemplates} className="text-xs">
                        Back to templates
                    </Button>
                </div>
            )}
        </div>
    );
}

export default TransformationAnalysis;
