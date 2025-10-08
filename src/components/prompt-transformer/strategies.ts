import type { TransformationStepState } from "./activity-log-panel";

export const TRANSFORMATION_STEPS_BASE: Array<Omit<TransformationStepState, "status">> = [
    {
        title: "Analyzing Raw Prompt",
        description: "Identifying key entities and user intent.",
        details: undefined,
    },
    {
        title: "Defining Core Objectives",
        description: "Structuring the primary goals for the AI.",
        details: undefined,
    },
    {
        title: "Applying Engineering Principles",
        description: "Injecting constraints, context, and formatting rules.",
        details: undefined,
    },
    {
        title: "Refining Final Output",
        description: "Performing final checks for clarity and effectiveness.",
        details: undefined,
    },
    {
        title: "Thinking…",
        description: "Compiling the final prompt text.",
        details: undefined,
    },
];

export function createPendingSteps(): TransformationStepState[] {
    return TRANSFORMATION_STEPS_BASE.map((step) => ({ ...step, status: "pending" as const }));
}

export function createInitialSteps(): TransformationStepState[] {
    return TRANSFORMATION_STEPS_BASE.map((step, index) => ({
        ...step,
        status: index === 0 ? ("in-progress" as const) : ("pending" as const),
    }));
}

export function createProgressiveSteps(targetIndex: number): TransformationStepState[] {
    return TRANSFORMATION_STEPS_BASE.map((step, index) => {
        if (index < targetIndex) {
            return { ...step, status: "completed" as const };
        }

        if (index === targetIndex) {
            return { ...step, status: "in-progress" as const };
        }

        return { ...step, status: "pending" as const };
    });
}

export function createCompletedSteps(): TransformationStepState[] {
    return TRANSFORMATION_STEPS_BASE.map((step) => ({
        ...step,
        status: "completed" as const,
    }));
}
