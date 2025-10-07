"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Loader2, Sparkles } from "lucide-react";

export type StepStatus = "pending" | "in-progress" | "completed";

export type TransformationStepDetail =
  | {
      type: "functionCall";
      name: string;
      args: Record<string, unknown>;
    }
  | undefined;

export type TransformationStepState = {
  title: string;
  description: string;
  details?: TransformationStepDetail;
  status: StepStatus;
};

interface ActivityLogPanelProps {
  steps: TransformationStepState[];
  onBackToTemplates?: () => void;
  canDismiss?: boolean;
}

export function ActivityLogPanel({ steps, onBackToTemplates, canDismiss = true }: ActivityLogPanelProps) {
  const allComplete = steps.every((step) => step.status === "completed");
  const renderDetails = (details: TransformationStepDetail) => {
    if (!details) return null;

    if (details.type === "functionCall") {
      const payload = `${details.name}(${JSON.stringify(details.args, null, 2)})`;
      return (
        <pre className="mt-3 rounded-md bg-muted/60 p-3 text-xs font-mono leading-relaxed text-muted-foreground">
          {payload}
        </pre>
      );
    }

    return null;
  };

  const iconForStatus = (status: StepStatus) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case "in-progress":
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      default:
        return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="flex h-full flex-col rounded-2xl border bg-card shadow-sm">
      <div className="flex items-start justify-between gap-2 border-b px-5 py-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium tracking-tight">
            <Sparkles className="h-4 w-4 text-primary" /> Transformation Activity
          </p>
          <p className="text-xs text-muted-foreground">
            Real-time view of the engineering reasoning steps powering this transform.
          </p>
        </div>
        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
          {allComplete ? "Complete" : "Live"}
        </Badge>
      </div>

      <ScrollArea className="flex-1 px-5 py-4">
        <div className="relative space-y-6">
          <div className="absolute left-[7px] top-4 bottom-4 w-px bg-border" aria-hidden />
          {steps.map((step, index) => (
            <div key={index} className="relative pl-6">
              <span className="absolute left-0 top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-background">
                {iconForStatus(step.status)}
              </span>
              <div className="space-y-1">
                <p
                  className={cn("text-sm font-medium", {
                    "text-muted-foreground": step.status === "pending",
                    "text-foreground": step.status === "in-progress",
                    "text-emerald-500": step.status === "completed",
                  })}
                >
                  {step.title}
                </p>
                <p
                  className={cn("text-xs", {
                    "text-muted-foreground": step.status === "pending",
                    "text-foreground": step.status === "in-progress",
                    "text-emerald-600": step.status === "completed",
                  })}
                >
                  {step.description}
                </p>
                {renderDetails(step.details)}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {onBackToTemplates && (
        <div className="border-t bg-muted/40 px-5 py-3 text-right">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBackToTemplates}
            disabled={!canDismiss}
            className="text-xs"
          >
            Back to templates
          </Button>
        </div>
      )}
    </div>
  );
}

export default ActivityLogPanel;
