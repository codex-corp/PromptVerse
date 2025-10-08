"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
    AlertCircle,
    Copy,
    Download,
    ExternalLink,
    Plus,
    RotateCcw,
    X,
    ChevronDown,
    HelpCircle,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import type { Components } from "react-markdown";
import type { HTMLAttributes, ReactNode } from "react";

type MarkdownCodeProps = HTMLAttributes<HTMLElement> & {
    inline?: boolean;
    className?: string;
    children?: ReactNode;
    node?: unknown;
};

import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { toast } from "sonner";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

import { MARKDOWN_PROMPT, JSON_PROMPT, CHATGPT_PROMPT } from "./prompts";
import { MODE_DEFINITIONS, deriveModeSuggestions, loadAnalyticsFromStorage, persistAnalytics } from "./mode-guidance";
import {
    extractModesFromPrompt,
    toRTF,
    getFileExtension,
    formatFileSize,
    readFileContentWithSanitization,
} from "./utils";
import type {
    ModeAnalyticsState,
    ModeSuggestion,
    PromptProfile,
    PromptTransformerProps,
    TransformResult,
    TransformedPrompt
} from "./types";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import TemplatesPanel from "./templates-panel";
import { ENGINEERING_TEMPLATE_CATEGORIES, ENGINEERING_TEMPLATES_FLAT, type EngineeringTemplate } from "./templates-data";
import { cn } from "@/lib/utils";
import { PromptTransformerFileAttachments, type UploadedFileState } from "./file-attachments";
import ActivityLogPanel, { type TransformationStepState } from "./activity-log-panel";
import ContextualOptimizer, { type OptimizerSnippetPayload } from "./contextual-optimizer";

const ACCEPTED_EXTENSIONS = [
    ".py",
    ".php",
    ".js",
    ".ts",
    ".html",
    ".css",
    ".md",
    ".txt",
    ".json",
    ".csv",
    ".xml",
    ".yml",
    ".yaml",
    ".ini",
    ".conf",
    ".sql",
    ".bash",
    ".sh",
    ".bat",
    ".ps1",
    ".env",
    ".log",
    ".pdf",
    ".docx",
    ".xlsx",
    ".jpg",
    ".jpeg"
];
const MAX_FILES = 10;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_TOTAL_IMAGE_BYTES = 1024 * 1024;
const MAX_CONTEXT_SIZE = 100 * 1024;
const MAX_INPUT_LENGTH = 8000;
const INPUT_COST_PER_1K = 0.005; // Approximate GPT‑4o input cost
const OUTPUT_COST_PER_1K = 0.015; // Approximate GPT‑4o output cost
const OUTPUT_TOKEN_MULTIPLIER = 1.5;
const TRANSFORMATION_STEPS_BASE = [
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
] satisfies Array<Omit<TransformationStepState, "status">>;

const enforceContextLimit = (files: UploadedFileState[]) => {
    const sortedByAdded = [...files].sort((a, b) => a.addedAt - b.addedAt);
    let total = sortedByAdded.reduce((sum, file) => sum + (file.content?.length ?? 0), 0);
    const removalSet = new Set<string>();

    let imageBytes = sortedByAdded.reduce((sum, file) => {
        const extension = file.name.split('.').pop()?.toLowerCase();
        if (extension && ["jpg", "jpeg", "png", "gif", "webp"].includes(extension)) {
            return sum + (file.size ?? 0);
        }
        return sum;
    }, 0);

    while (total > MAX_CONTEXT_SIZE && sortedByAdded.length) {
        const oldest = sortedByAdded.shift();
        if (!oldest) {
            break;
        }
        removalSet.add(oldest.id);
        total -= oldest.content?.length ?? 0;
        const extension = oldest.name.split('.').pop()?.toLowerCase();
        if (extension && ["jpg", "jpeg"].includes(extension)) {
            imageBytes -= oldest.size ?? 0;
        }
    }

    while (imageBytes > MAX_TOTAL_IMAGE_BYTES && sortedByAdded.length) {
        const oldest = sortedByAdded.shift();
        if (!oldest) {
            break;
        }
        removalSet.add(oldest.id);
        const extension = oldest.name.split('.').pop()?.toLowerCase();
        if (extension && ["jpg", "jpeg"].includes(extension)) {
            imageBytes -= oldest.size ?? 0;
        }
    }

    const nextFiles = files.filter((file) => !removalSet.has(file.id));
    const removedFiles = files.filter((file) => removalSet.has(file.id));

    return { nextFiles, removedFiles };
};

export function PromptTransformer({ open, onOpenChange, authorId, onPromptAdded }: PromptTransformerProps) {
    const [inputText, setInputText] = useState("");
    const [selectedPrompt, setSelectedPrompt] = useState(MARKDOWN_PROMPT);
    const [isTransforming, setIsTransforming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [format, setFormat] = useState<"markdown" | "json">("markdown");
    const [targetProfile, setTargetProfile] = useState<PromptProfile>("standard");
    const [result, setResult] = useState<TransformResult | null>(null);
    const [isAddingToPrompts, setIsAddingToPrompts] = useState(false);
    const [charCount, setCharCount] = useState(0);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [suggestedModes, setSuggestedModes] = useState<ModeSuggestion[]>([]);
    const [forcedModes, setForcedModes] = useState<string[]>([]);
    const [modeAnalytics, setModeAnalytics] = useState<ModeAnalyticsState>(() => loadAnalyticsFromStorage());
    const abortControllerRef = useRef<AbortController | null>(null);
    const inputTextareaRef = useRef<HTMLTextAreaElement | null>(null);
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFileState[]>([]);
    const [activitySteps, setActivitySteps] = useState<TransformationStepState[]>(() =>
        TRANSFORMATION_STEPS_BASE.map((step) => ({ ...step, status: "pending" as const }))
    );
    const [isActivityVisible, setIsActivityVisible] = useState(false);
    const activityTimeoutsRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
    const [optimizerDialogOpen, setOptimizerDialogOpen] = useState(false);
    const [optimizerSelectedFile, setOptimizerSelectedFile] = useState<UploadedFileState | null>(null);

    const tokenMetrics = useMemo(() => {
        const promptTokens = Math.ceil(charCount / 4);
        if (promptTokens === 0) {
            return {
                promptTokens: 0,
                estimatedOutputTokens: 0,
                totalTokens: 0,
                inputCost: 0,
                outputCost: 0,
                totalCost: 0,
                complexity: "Low" as const,
            };
        }

        const estimatedOutputTokens = Math.max(120, Math.ceil(promptTokens * OUTPUT_TOKEN_MULTIPLIER));
        const totalTokens = promptTokens + estimatedOutputTokens;
        const inputCost = (promptTokens / 1000) * INPUT_COST_PER_1K;
        const outputCost = (estimatedOutputTokens / 1000) * OUTPUT_COST_PER_1K;
        const totalCost = inputCost + outputCost * 10;

        let complexity: "Low" | "Medium" | "High" = "Low";
        if (promptTokens > 1200) {
            complexity = "High";
        } else if (promptTokens > 400) {
            complexity = "Medium";
        }

        const complexityColors: Record<typeof complexity, string> = {
            Low: "text-emerald-500 border-emerald-500/50 bg-emerald-500/10",
            Medium: "text-amber-500 border-amber-500/50 bg-amber-500/10",
            High: "text-red-500 border-red-500/50 bg-red-500/10",
        };

        return {
            promptTokens,
            estimatedOutputTokens,
            totalTokens,
            inputCost,
            outputCost,
            totalCost,
            complexity,
            complexityClass: complexityColors[complexity],
        };
    }, [charCount]);

    const topModes = useMemo(() => {
        const entries = Object.entries(modeAnalytics.modeCounts);
        return entries.sort((a, b) => b[1] - a[1]).slice(0, 5);
    }, [modeAnalytics.modeCounts]);

    const availableModes = useMemo(
        () => MODE_DEFINITIONS.filter((mode) => !forcedModes.includes(mode.id)),
        [forcedModes]
    );
    const quickTemplates = useMemo(() => ENGINEERING_TEMPLATES_FLAT.slice(0, 4), []);

    const clearActivityTimers = useCallback(() => {
        for (const timeout of activityTimeoutsRef.current) {
            clearTimeout(timeout);
        }
        activityTimeoutsRef.current = [];
    }, []);

    const startActivityLog = useCallback(() => {
        clearActivityTimers();
        setIsActivityVisible(true);
        setActivitySteps(
            TRANSFORMATION_STEPS_BASE.map((step, idx) => ({
                ...step,
                status: idx === 0 ? "in-progress" : "pending",
            }))
        );

        activityTimeoutsRef.current = TRANSFORMATION_STEPS_BASE.map((_, idx) => {
            if (idx === 0) return null;
            return setTimeout(() => {
                setActivitySteps(
                    TRANSFORMATION_STEPS_BASE.map((step, stepIdx) => {
                        if (stepIdx < idx) {
                            return { ...step, status: "completed" as const };
                        }
                        if (stepIdx === idx) {
                            return { ...step, status: "in-progress" as const };
                        }
                        return { ...step, status: "pending" as const };
                    })
                );
            }, idx * 700);
        }).filter(Boolean) as Array<ReturnType<typeof setTimeout>>;
    }, [clearActivityTimers]);

    const completeActivityLog = useCallback(() => {
        clearActivityTimers();
        setActivitySteps(
            TRANSFORMATION_STEPS_BASE.map((step) => ({
                ...step,
                status: "completed" as const,
            }))
        );
    }, [clearActivityTimers]);

    const resetActivityLog = useCallback(
        (hidePanel = true) => {
            clearActivityTimers();
            setActivitySteps(
                TRANSFORMATION_STEPS_BASE.map((step) => ({
                    ...step,
                    status: "pending" as const,
                }))
            );
            if (hidePanel) {
                setIsActivityVisible(false);
            }
        },
        [clearActivityTimers],
    );

    const hideActivityLog = useCallback(() => {
        setIsActivityVisible(false);
        clearActivityTimers();
        setActivitySteps(
            TRANSFORMATION_STEPS_BASE.map((step) => ({
                ...step,
                status: "pending" as const,
            }))
        );
    }, [clearActivityTimers]);

const HANDOFF_TARGETS: Array<{
    id: string;
    label: string;
    url: string;
    queryParam?: string;
    maxLength?: number;
    prefill?: boolean;
}> = [
    { id: "chatgpt", label: "ChatGPT", url: "https://chat.openai.com/", queryParam: "q", maxLength: 6000, prefill: true },
    { id: "copilot", label: "GitHub Copilot", url: "https://copilot.microsoft.com/", queryParam: "q", maxLength: 6000, prefill: true },
    { id: "perplexity", label: "Perplexity", url: "https://www.perplexity.ai/search", queryParam: "q", maxLength: 6000, prefill: true },
    { id: "claude", label: "Claude", url: "https://claude.ai/chats", prefill: false },
    { id: "mistral", label: "Mistral", url: "https://chat.mistral.ai/chat", prefill: false },
    { id: "grok", label: "Grok Deep Search", url: "https://x.com/i/grok", prefill: false },
    { id: "gemini", label: "Gemini", url: "https://gemini.google.com/app", prefill: false },
    { id: "meta", label: "Meta Llama", url: "https://www.llama.com/llama-chat/", prefill: false },
];

    const deriveTitleFromContent = useCallback((content: string) => {
        const lines = content
            .split(/\n+/)
            .map((line) => line.trim())
            .filter(Boolean);

        if (!lines.length) return "Untitled Prompt";

        const firstLine = lines[0].replace(/^#+\s*/, "");
        return firstLine.slice(0, 80) || "Untitled Prompt";
    }, []);

    const buildChatGPTMetadata = useCallback(
        (content: string) => {
            const lines = content.split(/\n+/).map((line) => line.trim());
            const extractDirective = (label: string) => {
                const target = lines.find((line) => line.toUpperCase().startsWith(`/${label.toUpperCase()}:`));
                if (!target) return "";
                return target.split(":").slice(1).join(":").trim();
            };

            const truncate = (value: string, max = 220) => {
                if (!value) return value;
                return value.length > max ? `${value.slice(0, max - 1).trim()}…` : value;
            };

            const role = extractDirective("ROLE");
            const task = extractDirective("TASK");
            const formatDirective = extractDirective("FORMAT");
            const context = extractDirective("CONTEXT");
            const quality = extractDirective("QUALITY BAR");

            const title = role ? `ChatGPT · ${role}` : deriveTitleFromContent(content);

            const descriptionParts: string[] = [];
            if (task) descriptionParts.push(task);
            if (formatDirective) descriptionParts.push(`Format: ${formatDirective}`);
            if (quality) descriptionParts.push(`Quality: ${quality}`);
            if (context) descriptionParts.push(`Context: ${context}`);

            const description = descriptionParts.length
                ? truncate(descriptionParts.join(" · "))
                : "Structured ChatGPT blueprint generated via Prompt Transformer.";

            return { title, description };
        },
        [deriveTitleFromContent]
    );

    const buildStandardMetadata = useCallback(
        (content: string) => {
            const cleaned = content
                .replace(/```[\s\S]*?```/g, "")
                .replace(/\s+/g, " ")
                .trim();

            const title = deriveTitleFromContent(content);

            if (!cleaned) {
                return {
                    title,
                    description: "Refined prompt captured from Prompt Transformer.",
                };
            }

            const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean);
            const description = sentences.length
                ? `${sentences.slice(0, 2).join(" ")}`.slice(0, 220).trim()
                : cleaned.slice(0, 220).trim();

            return {
                title,
                description: description || "Refined prompt captured from Prompt Transformer.",
            };
        },
        [deriveTitleFromContent]
    );

    const generatePromptMetadata = useCallback(
        (content: string, profile: PromptProfile) => {
            if (profile === "chatgpt") {
                return buildChatGPTMetadata(content);
            }

            return buildStandardMetadata(content);
        },
        [buildChatGPTMetadata, buildStandardMetadata]
    );

    const toNullableNumber = useCallback((value: unknown) => {
        if (value === undefined || value === null || value === "") return null;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }, []);

    const runTour = useCallback(() => {
        const steps = [
            {
                element: '[data-tour-id="tour-header"]',
                popover: {
                    title: "Welcome to Prompt Transformer",
                    description: "Open this workspace from anywhere with double Shift. Use Ctrl + H anytime to replay this tour.",
                    side: "bottom" as const,
                    align: "start" as const,
                },
            },
            {
                element: '[data-tour-id="templates-panel"]',
                popover: {
                    title: "Engineering templates",
                    description: "Kick off with production-ready prompts for reviews, debugging, migrations, and more.",
                    side: "left" as const,
                    align: "start" as const,
                },
            },
            {
                element: '[data-tour-id="tour-raw-prompt"]',
                popover: {
                    title: "Describe your task",
                    description: "Share context, constraints, and success criteria. The transformer will amplify it.",
                    side: "top" as const,
                    align: "center" as const,
                },
            },
            {
                element: '[data-tour-id="tour-system-prompt"]',
                popover: {
                    title: "Tune the transformation",
                    description: "Choose Standard or ChatGPT mode and edit the system prompt that guides the rewrite.",
                    side: "top" as const,
                    align: "center" as const,
                },
            },
            {
                element: '[data-tour-id="tour-output-format"]',
                popover: {
                    title: "Pick your output",
                    description: "Switch between Markdown and JSON formats. ChatGPT mode enforces its scaffold automatically.",
                    side: "top" as const,
                    align: "end" as const,
                },
            },
            {
                element: '[data-tour-id="tour-output"]',
                popover: {
                    title: "Review the upgraded prompt",
                    description: "Inspect the generated instructions before handing them off to your model or teammate.",
                    side: "top" as const,
                    align: "center" as const,
                },
            },
            {
                element: '[data-tour-id="tour-actions"]',
                popover: {
                    title: "Save and share",
                    description: "Store the prompt in your library, clear the workspace, or close when you’re all set.",
                    side: "bottom" as const,
                    align: "center" as const,
                },
            },
        ];

        if (targetProfile === "chatgpt") {
            steps.push(
                {
                    element: '[data-tour-id="tour-mode-guidance"]',
                    popover: {
                        title: "Guided modes",
                        description: "AI suggests reasoning modes like /STEP-BY-STEP or /CHECKLIST. Toggle to pin them into the final prompt.",
                        side: "left" as const,
                        align: "start" as const,
                    },
                },
                {
                    element: '[data-tour-id="tour-mode-analytics"]',
                    popover: {
                        title: "Session insights",
                        description: "See which modes the team relies on most so you can standardise effective workflows.",
                        side: "left" as const,
                        align: "start" as const,
                    },
                }
            );
        }

        const filteredSteps = steps.filter((step) => document.querySelector(step.element));

        if (!filteredSteps.length) {
            toast.info("Nothing to tour yet. Try again after the UI finishes loading.");
            return;
        }

        const tour = driver({
            showProgress: true,
            overlayOpacity: 0.55,
            stageRadius: 12,
            allowClose: true,
            steps: filteredSteps,
        });

        tour.drive();
    }, [targetProfile]);

    const getFileExtension = useCallback((fileName: string) => {
        const dotIndex = fileName.lastIndexOf(".");
        return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : "";
    }, []);

    const getUniqueFileName = useCallback((fileName: string, existingNames: Set<string>) => {
        if (!existingNames.has(fileName)) {
            return fileName;
        }

        const dotIndex = fileName.lastIndexOf(".");
        const baseName = dotIndex >= 0 ? fileName.slice(0, dotIndex) : fileName;
        const extension = dotIndex >= 0 ? fileName.slice(dotIndex) : "";

        let counter = 1;
        let candidate = `${baseName} (${counter})${extension}`;

        while (existingNames.has(candidate)) {
            counter += 1;
            candidate = `${baseName} (${counter})${extension}`;
        }

        return candidate;
    }, []);

    const handleFilesAdded = useCallback(
        (incoming: FileList | File[]) => {
            const candidates = Array.from(incoming);
            if (!candidates.length) return;

            let remainingSlots = MAX_FILES - uploadedFiles.length;
            if (remainingSlots <= 0) {
                toast.error(`You can upload up to ${MAX_FILES} files.`);
                return;
            }

            const uniqueNames = new Set(uploadedFiles.map((file) => file.name));
            const accepted: UploadedFileState[] = [];
            const invalidTypes: string[] = [];
            const oversized: string[] = [];
            let limitWarning = false;
            const timestamp = Date.now();

            candidates.forEach((file) => {
                if (remainingSlots <= 0) {
                    limitWarning = true;
                    return;
                }

                const extension = getFileExtension(file.name);
                if (!ACCEPTED_EXTENSIONS.includes(extension)) {
                    invalidTypes.push(file.name);
                    return;
                }

                if (file.size > MAX_FILE_SIZE) {
                    oversized.push(file.name);
                    return;
                }

                const uniqueName = getUniqueFileName(file.name, uniqueNames);
                uniqueNames.add(uniqueName);

                accepted.push({
                    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                    file,
                    name: uniqueName,
                    size: file.size,
                    previewOpen: false,
                    status: "idle",
                    preview: undefined,
                    content: undefined,
                    addedAt: timestamp + accepted.length,
                });
                remainingSlots -= 1;
            });

            if (invalidTypes.length) {
                toast.error(`Unsupported file type: ${invalidTypes.join(", ")}`);
            }

            if (oversized.length) {
                toast.error(`File too large (max 5MB): ${oversized.join(", ")}`);
            }

            if (limitWarning) {
                toast.error(`Only ${MAX_FILES} files can be uploaded at a time.`);
            }

            if (accepted.length) {
                setUploadedFiles((prev) => [...prev, ...accepted]);
                toast.success(
                    `${accepted.length} file${accepted.length === 1 ? "" : "s"} added to the prompt context.`,
                    { duration: 2500 }
                );
            }
        },
        [getFileExtension, getUniqueFileName, uploadedFiles]
    );

    const handleRemoveFile = useCallback((fileId: string) => {
        setUploadedFiles((prev) => prev.filter((file) => file.id !== fileId));
        toast.success("File removed from prompt context.");
    }, []);

    const handleRemoveAll = useCallback(() => {
        if (uploadedFiles.length === 0) {
            return;
        }
        setUploadedFiles([]);
        toast.success("All files removed from prompt context.");
    }, [uploadedFiles]);

    const handleTogglePreview = useCallback(
        (fileId: string) => {
            const target = uploadedFiles.find((file) => file.id === fileId);
            if (!target) {
                return;
            }

            const shouldOpen = !target.previewOpen;

            if (!shouldOpen) {
                setUploadedFiles((prev) =>
                    prev.map((file) => (file.id === fileId ? { ...file, previewOpen: false } : file))
                );
                return;
            }

            if (target.preview) {
                setUploadedFiles((prev) =>
                    prev.map((file) => (file.id === fileId ? { ...file, previewOpen: true } : file))
                );
                return;
            }

            setUploadedFiles((prev) =>
                prev.map((file) =>
                    file.id === fileId
                        ? { ...file, previewOpen: true, status: "parsing" }
                        : file
                )
            );

            readFileContentWithSanitization(target.file)
                .then(({ sanitized, preview, isBinary }) => {
                    setUploadedFiles((current) =>
                        current.map((file) => {
                            if (file.id !== fileId) return file;

                            if (isBinary) {
                                return {
                                    ...file,
                                    previewOpen: true,
                                    preview,
                                    status: "error",
                                    content: "",
                                };
                            }

                            return {
                                ...file,
                                previewOpen: true,
                                preview,
                                status: "parsed",
                                content: file.content ?? sanitized,
                            };
                        })
                    );
                })
                .catch(() => {
                    toast.warning(`Unable to preview ${target.name}.`);
                    setUploadedFiles((current) =>
                        current.map((file) =>
                            file.id === fileId
                                ? {
                                      ...file,
                                      previewOpen: true,
                                      preview: "Preview unavailable.",
                                      status: "error",
                                  }
                                : file
                        )
                    );
                });
        },
        [uploadedFiles]
    );

    const appendToInputText = useCallback(
        (
            content: string,
            {
                prependNewlines = true,
                atSelection = true,
            }: { prependNewlines?: boolean; atSelection?: boolean } = {}
        ) => {
            if (!content.trim()) {
                return;
            }

            const textarea = inputTextareaRef.current;

            setInputText((previous) => {
                let before = previous;
                let selected = "";
                let after = "";

                if (textarea && atSelection) {
                    const start = Math.max(0, Math.min(previous.length, textarea.selectionStart ?? previous.length));
                    const end = Math.max(start, Math.min(previous.length, textarea.selectionEnd ?? previous.length));
                    before = previous.slice(0, start);
                    selected = previous.slice(start, end);
                    after = previous.slice(end);
                }

                const normalized = content.trimEnd();
                let insertSegment = normalized;
                let afterSegment = after;

                if (selected.trim().length > 0) {
                    const selectionCore = selected.trimEnd();
                    const spacer = selectionCore.length ? "\n\n" : "";
                    insertSegment = `${selectionCore}${spacer}${normalized}`;
                    if (afterSegment.length && !afterSegment.startsWith("\n")) {
                        afterSegment = `\n\n${afterSegment}`;
                    }
                } else {
                    if (prependNewlines && before.length && !before.endsWith("\n")) {
                        insertSegment = `\n\n${insertSegment}`;
                    }
                    if (prependNewlines && afterSegment.length && !afterSegment.startsWith("\n")) {
                        afterSegment = `\n\n${afterSegment}`;
                    }
                }

                let combined = before + insertSegment + afterSegment;
                let caretIndex = (before + insertSegment).length;

                if (combined.length > MAX_INPUT_LENGTH) {
                    toast.info(`Injected content truncated to ${MAX_INPUT_LENGTH} characters.`);
                    combined = combined.slice(0, MAX_INPUT_LENGTH);
                    caretIndex = Math.min(caretIndex, combined.length);
                }

                setCharCount(combined.length);

                requestAnimationFrame(() => {
                    const textareaInstance = inputTextareaRef.current;
                    if (!textareaInstance) {
                        return;
                    }
                    textareaInstance.focus();
                    textareaInstance.setSelectionRange(caretIndex, caretIndex);
                });

                return combined;
            });
        },
        [toast]
    );

    const handleInjectFile = useCallback(
        (fileId: string) => {
            const targetFile = uploadedFiles.find((file) => file.id === fileId);
            if (!targetFile) {
                return;
            }

            const targetFileName = targetFile.name;

            const injectContent = (raw: string | undefined) => {
                const trimmed = raw?.trim();
                if (!trimmed) {
                    toast.error("Content unavailable");
                    return;
                }

                appendToInputText(trimmed, { prependNewlines: true });
                toast.success(`Injected content from ${targetFileName}.`, { duration: 2200 });
            };

            if (typeof targetFile.content === "string" && targetFile.content.trim().length > 0) {
                injectContent(targetFile.content);
                return;
            }

            setUploadedFiles((prev) =>
                prev.map((file) =>
                    file.id === fileId
                        ? { ...file, status: "parsing" as const }
                        : file
                )
            );

            readFileContentWithSanitization(targetFile.file)
                .then(({ sanitized, preview, isBinary }) => {
                    if (isBinary) {
                        setUploadedFiles((current) =>
                            current.map((file) =>
                                file.id === fileId
                                    ? {
                                          ...file,
                                          status: "error" as const,
                                          content: "",
                                          preview: file.preview ?? preview ?? "Binary content unavailable.",
                                      }
                                    : file
                            )
                        );
                        toast.error("Content unavailable");
                        return;
                    }

                    const safeContent = sanitized ?? "";

                    setUploadedFiles((current) =>
                        current.map((file) =>
                            file.id === fileId
                                ? {
                                      ...file,
                                      status: "parsed" as const,
                                      content: safeContent,
                                      preview: file.preview ?? preview,
                                  }
                                : file
                        )
                    );

                    if (!safeContent.trim()) {
                        toast.error("Content unavailable");
                        return;
                    }

                    appendToInputText(safeContent, { prependNewlines: true });
                    toast.success(`Injected content from ${targetFileName}.`, { duration: 2200 });
                })
                .catch((error) => {
                    console.error("Failed to inject file content", error);
                    toast.error("Content unavailable");
                    setUploadedFiles((current) =>
                        current.map((file) =>
                            file.id === fileId
                                ? {
                                      ...file,
                                      status: "error" as const,
                                      content: file.content ?? "",
                                  }
                                : file
                        )
                    );
                });
        },
        [appendToInputText, toast, uploadedFiles]
    );

    const parseFilesForContext = useCallback(async () => {
        const filesToParse = uploadedFiles.filter((file) => file.content === undefined && file.status !== "parsing");

        if (filesToParse.length === 0) {
            const { nextFiles, removedFiles } = enforceContextLimit(uploadedFiles);
            if (removedFiles.length) {
                setUploadedFiles(nextFiles);
                toast.warning(
                    `Removed ${removedFiles.length} file${removedFiles.length === 1 ? "" : "s"} to keep context under 100KB.`,
                    {
                        description: removedFiles.map((file) => file.name).join(", "),
                    }
                );
            }
            return nextFiles;
        }

        const idsBeingParsed = new Set(filesToParse.map((file) => file.id));

        setUploadedFiles((prev) =>
            prev.map((file) => (idsBeingParsed.has(file.id) ? { ...file, status: "parsing" } : file))
        );

        const results = await Promise.all(
            filesToParse.map(async (file) => {
                try {
                    const parsed = await readFileContentWithSanitization(file.file);
                    return { id: file.id, file, ...parsed };
                } catch (error) {
                    console.error("Failed to parse file content", error);
                    toast.warning(`Unable to parse ${file.name}. Skipping from prompt context.`);
                    return { id: file.id, file, error: true as const };
                }
            })
        );

        let removed: UploadedFileState[] = [];


        const updatedFiles = await new Promise<UploadedFileState[]>((resolve) => {
            setUploadedFiles((prev) => {
                const resultMap = new Map(results.map((item) => [item.id, item]));

                const next = prev.map((file) => {
                    const result = resultMap.get(file.id);
                    if (!result) {
                        return file;
                    }

                    if ("error" in result) {
                        return {
                            ...file,
                            status: "error" as const,
                            content: "",
                            preview: file.preview ?? "Preview unavailable.",
                        };
                    }

                    if (result.isBinary) {
                        return {
                            ...file,
                            status: "error" as const,
                            content: "",
                            preview: file.preview ?? result.preview,
                        };
                    }

                    return {
                        ...file,
                        status: "parsed" as const,
                        content: result.sanitized,
                        preview: file.preview ?? result.preview,
                    };
                });

                const { nextFiles, removedFiles } = enforceContextLimit(next);
                removed = removedFiles;
                resolve(nextFiles);
                return nextFiles;
            });
        });

        if (removed.length) {
            toast.warning(
                `Removed ${removed.length} file${removed.length === 1 ? "" : "s"} to keep context under 100KB.`,
                {
                    description: removed.map((file) => file.name).join(", "),
                }
            );
        }

        return updatedFiles;
    }, [uploadedFiles]);

    const handleCloseOptimizer = useCallback(() => {
        setOptimizerDialogOpen(false);
        setOptimizerSelectedFile(null);
    }, []);

    const handleOpenOptimizer = useCallback(
        (fileId: string) => {
            const targetFile = uploadedFiles.find((file) => file.id === fileId);
            if (!targetFile) {
                toast.error("Unable to open optimizer for this file.");
                return;
            }

            setOptimizerSelectedFile(targetFile);
            setOptimizerDialogOpen(true);
        },
        [uploadedFiles]
    );

    const handleInjectOptimizerSnippet = useCallback(
        ({ snippet }: OptimizerSnippetPayload) => {
            const trimmedSnippet = snippet.trim();
            if (!trimmedSnippet) {
                return;
            }

            appendToInputText(trimmedSnippet, { prependNewlines: true });
            toast.success("Snippet injected into raw prompt.");
            handleCloseOptimizer();
        },
        [appendToInputText, handleCloseOptimizer]
    );

    const buildAugmentedPrompt = useCallback(async () => {
        const parsed = await parseFilesForContext();
        const filesWithContent = parsed.filter((file) => (file.content?.length ?? 0) > 0);

        if (!filesWithContent.length) {
            return { augmentedInput: inputText, files: filesWithContent };
        }

        const contextAppendix = filesWithContent
            .map((file) => `[Context: ${file.name} (${formatFileSize(file.size)})]\n${file.content}`)
            .join("\n\n");

        const needsSpacer = inputText.trim().length > 0 && !inputText.trimEnd().endsWith("\n\n");
        const spacer = needsSpacer ? (inputText.endsWith("\n") ? "\n" : "\n\n") : "";
        return {
            augmentedInput: `${inputText}${spacer}${contextAppendix}`,
            files: filesWithContent,
        };
    }, [inputText, parseFilesForContext]);

    const isChatGPT = targetProfile === "chatgpt";
    const showResult = Boolean(result);
    const isProcessing = isTransforming || isRegenerating;

    useEffect(() => {
        if (targetProfile !== "standard") {
            return;
        }

        if (format === "json") {
            setSelectedPrompt(JSON_PROMPT);
        } else {
            setSelectedPrompt(MARKDOWN_PROMPT);
        }
    }, [format, targetProfile]);

    useEffect(() => {
        if (targetProfile === "chatgpt") {
            setSuggestedModes(deriveModeSuggestions(inputText));
        } else {
            setSuggestedModes([]);
            setForcedModes([]);
        }
    }, [inputText, targetProfile]);

    useEffect(() => {
        persistAnalytics(modeAnalytics);
    }, [modeAnalytics]);

    const markdownComponents: Components = {
        code({ node: _node, inline, className, children, ...props }: MarkdownCodeProps) {
            const match = /language-(\w+)/.exec(className || "");
            return !inline && match ? (
                <SyntaxHighlighter style={atomDark} language={match[1]} PreTag="div" {...props}>
                    {String(children).replace(/\n$/, "")}
                </SyntaxHighlighter>
            ) : (
                <code className={className} {...props}>
                    {children}
                </code>
            );
        },
    };

    const handleProfileChange = (profile: PromptProfile) => {
        setTargetProfile(profile);

        if (profile === "chatgpt") {
            if (format !== "markdown") {
                setFormat("markdown");
            }
            setSelectedPrompt(CHATGPT_PROMPT);
            return;
        }

        setForcedModes([]);
        setSelectedPrompt(format === "json" ? JSON_PROMPT : MARKDOWN_PROMPT);
    };

    const toggleForcedMode = (modeId: string) => {
        setForcedModes((prev) => (prev.includes(modeId) ? prev.filter((mode) => mode !== modeId) : [...prev, modeId]));
    };

    const applySuggestion = (modeId: string) => {
        toggleForcedMode(modeId);
    };

    const buildSystemPrompt = () => {
        if (targetProfile !== "chatgpt" || forcedModes.length === 0) {
            return selectedPrompt;
        }

        const forcedBlock = `\nThe following modes are mandatory for this request: ${forcedModes.join(", ")}. If any seem off-target, ask the user for clarification before omitting them.`;
        return `${selectedPrompt}${forcedBlock}`;
    };

    const updateModeAnalytics = (promptText: string) => {
        if (!promptText) return;
        const parsedModes = extractModesFromPrompt(promptText);
        if (!parsedModes.length) return;

        setModeAnalytics((prev) => {
            const updatedCounts = { ...prev.modeCounts };
            parsedModes.forEach((mode) => {
                updatedCounts[mode] = (updatedCounts[mode] || 0) + 1;
            });

            return {
                totalTransforms: prev.totalTransforms + 1,
                modeCounts: updatedCounts,
                lastModes: parsedModes,
            };
        });
    };

    useEffect(() => {
        let shiftPressCount = 0;
        let lastShiftTime = 0;

        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.key === "h" || e.key === "H") && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();

                if (!open) {
                    onOpenChange(true);
                    requestAnimationFrame(() => {
                        setTimeout(() => runTour(), 120);
                    });
                } else {
                    runTour();
                }
                return;
            }

            if (e.key === "Shift") {
                const now = Date.now();

                if (now - lastShiftTime > 500) {
                    shiftPressCount = 0;
                }

                shiftPressCount++;
                lastShiftTime = now;

                if (shiftPressCount === 2) {
                    e.preventDefault();
                    onOpenChange(true);
                    shiftPressCount = 0;
                }
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [open, onOpenChange, runTour]);

    useEffect(() => {
        if (!open) {
            resetActivityLog();
        }
    }, [open, resetActivityLog]);

    useEffect(() => {
        return () => {
            clearActivityTimers();
        };
    }, [clearActivityTimers]);

    const handleTransform = async () => {
        if (!inputText.trim()) {
            setError("Input text cannot be empty");
            return;
        }

        setError(null);
        setIsTransforming(true);
        startActivityLog();

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            const { augmentedInput } = await buildAugmentedPrompt();
            const response = await fetch("/api/transform-prompt", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    inputText: augmentedInput,
                    systemPrompt: buildSystemPrompt(),
                    format,
                }),
                signal: controller.signal,
            });

            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(errorData || "Failed to transform prompt");
            }

            const data = await response.json();
            setResult({ refinedPrompt: data.refinedPrompt, format });
            completeActivityLog();
        } catch (error: any) {
            if (error.name === "AbortError") {
                return;
            }

            console.error("Error transforming prompt:", error);
            setError(error.message || "An error occurred while transforming the prompt");
            toast.error(error.message || "Failed to transform prompt");
            resetActivityLog();
        } finally {
            setIsTransforming(false);
            abortControllerRef.current = null;
        }
    };

    const handleRegenerate = async () => {
        if (!inputText.trim()) {
            setError("Input text cannot be empty");
            return;
        }

        setError(null);
        setIsRegenerating(true);
        startActivityLog();

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            const { augmentedInput } = await buildAugmentedPrompt();
            const response = await fetch("/api/transform-prompt", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    inputText: augmentedInput,
                    systemPrompt: buildSystemPrompt(),
                    format,
                }),
                signal: controller.signal,
            });

            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(errorData || "Failed to transform prompt");
            }

            const data = await response.json();
            setResult({ refinedPrompt: data.refinedPrompt, format });
            completeActivityLog();
        } catch (error: any) {
            if (error.name === "AbortError") {
                return;
            }

            console.error("Error regenerating prompt:", error);
            setError(error.message || "An error occurred while transforming the prompt");
            toast.error(error.message || "Failed to transform prompt");
            resetActivityLog();
        } finally {
            setIsRegenerating(false);
            abortControllerRef.current = null;
        }
    };

    const copyToClipboard = async (text: string) => {
        try {
            let contentToCopy = text;

            if (result?.format === "json") {
                try {
                    const parsed = JSON.parse(text);
                    contentToCopy = parsed.content || text;
                } catch {
                    contentToCopy = text;
                }
            } else {
                const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
                if (jsonMatch) {
                    try {
                        const parsed = JSON.parse(jsonMatch[1]);
                        contentToCopy = parsed.content || text;
                    } catch {
                        contentToCopy = text;
                    }
                }
            }

            await navigator.clipboard.writeText(contentToCopy);
            toast.success("Copied to clipboard!");
        } catch (error) {
            console.error("Failed to copy to clipboard:", error);
            toast.error("Failed to copy to clipboard");
        }
    };

    const copyAsRTF = async (text: string) => {
        const fallbackCopy = async () => {
            await navigator.clipboard.writeText(text);
            toast.success("Copied as plain text (RTF not supported)");
        };

        try {
            const rtfContent = toRTF(text);
            if (typeof window !== "undefined" && "ClipboardItem" in window && "write" in navigator.clipboard) {
                try {
                    const ClipboardItemConstructor = (window as typeof window & { ClipboardItem: typeof ClipboardItem }).ClipboardItem;
                    const clipboardItem = new ClipboardItemConstructor({
                        "text/rtf": new Blob([rtfContent], { type: "text/rtf" }),
                        "text/plain": new Blob([text], { type: "text/plain" }),
                    });
                    await navigator.clipboard.write([clipboardItem]);
                    toast.success("Copied as RTF!");
                    return;
                } catch (rtfError) {
                    console.warn("RTF copy unsupported, falling back to plain text", rtfError);
                    await fallbackCopy();
                    return;
                }
            }

            await fallbackCopy();
        } catch (error) {
            console.error("Failed to copy prompt:", error);
            toast.error("Failed to copy prompt");
        }
    };

    const downloadAsFile = (content: string, filename: string) => {
        try {
            const blob = new Blob([content], { type: "text/plain" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success("Download started!");
        } catch (error) {
            console.error("Failed to download file:", error);
            toast.error("Failed to download file");
        }
    };

    const addToPrompts = async () => {
        if (!result) return;

        setIsAddingToPrompts(true);
        try {
            if (!authorId) {
                throw new Error("Author not found. Please ensure you are logged in.");
            }

            let payload:
                | (TransformedPrompt & {
                      targetModel?: string;
                  })
                | null = null;

            if (result.format === "json") {
                const promptData: TransformedPrompt = JSON.parse(result.refinedPrompt);

                if (!promptData.content) {
                    throw new Error("Content is required in the transformed prompt");
                }

                const metadata = generatePromptMetadata(promptData.content, targetProfile);

                payload = {
                    ...promptData,
                    title: promptData.title?.trim() || metadata.title,
                    description: promptData.description?.trim() || metadata.description,
                    targetModel: promptData.targetModel || (targetProfile === "chatgpt" ? "gpt-4o" : "gpt-4"),
                };
            } else {
                const content = getDisplayContent();
                const metadata = generatePromptMetadata(content, targetProfile);

                payload = {
                    title: metadata.title,
                    content,
                    description: metadata.description,
                    targetModel: targetProfile === "chatgpt" ? "gpt-4o" : "gpt-4",
                    notes: `Captured via Prompt Transformer (${targetProfile} mode).`,
                    tags: targetProfile === "chatgpt" ? ["chatgpt", "transformer"] : ["markdown", "transformer"],
                } as TransformedPrompt & { targetModel: string };
            }

            if (!payload?.title || !payload.content) {
                throw new Error("Prompt is missing title or content");
            }

            const response = await fetch("/api/prompts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: payload.title,
                    content: payload.content,
                    description: payload.description,
                    targetModel: payload.targetModel,
                    temperature: toNullableNumber(payload.temperature),
                    maxTokens: toNullableNumber(payload.maxTokens),
                    topP: toNullableNumber(payload.topP),
                    frequencyPenalty: toNullableNumber(payload.frequencyPenalty),
                    presencePenalty: toNullableNumber(payload.presencePenalty),
                    notes: payload.notes,
                    category: payload.category ?? null,
                    tags: payload.tags,
                    authorId,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to create prompt");
            }

            const newPrompt = await response.json();

            if (newPrompt) {
                toast.success("Prompt saved to your library.", {
                    action: {
                        label: "View",
                        onClick: () => {
                            window.open(`/prompts/${newPrompt.id}`, "_blank", "noopener,noreferrer");
                        },
                    },
                });

                window.dispatchEvent(
                    new CustomEvent("promptverse:prompt-added", {
                        detail: { promptId: newPrompt.id },
                    })
                );

                onPromptAdded();
                resetForm();
            } else {
                throw new Error("Failed to create prompt");
            }
        } catch (error: any) {
            console.error("Error adding prompt:", error);
            toast.error(error.message || "Failed to add prompt");
        } finally {
            setIsAddingToPrompts(false);
        }
    };

    const resetForm = () => {
        setInputText("");
        setResult(null);
        setError(null);
        setIsTransforming(false);
        setIsRegenerating(false);
        setTargetProfile("standard");
        setFormat("markdown");
        setSelectedPrompt(MARKDOWN_PROMPT);
        setForcedModes([]);
        setSuggestedModes([]);
        setCharCount(0);
        resetActivityLog();
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
    };

    const handleClose = () => {
        resetForm();
        onOpenChange(false);
    };

    const getDisplayContent = () => {
        if (!result) return "";

        if (result.format === "json") {
            try {
                const parsed = JSON.parse(result.refinedPrompt);
                return parsed.content || result.refinedPrompt;
            } catch {
                return result.refinedPrompt;
            }
        }

        const jsonMatch = result.refinedPrompt.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[1]);
                return parsed.content || result.refinedPrompt;
            } catch {
                return result.refinedPrompt;
            }
        }

        return result.refinedPrompt;
    };

    const openInProvider = useCallback(
        (targetId: string) => {
            const target = HANDOFF_TARGETS.find((item) => item.id === targetId);
            if (!target) {
                toast.error("Unsupported handoff target");
                return;
            }

            const promptContent = getDisplayContent();

            if (!promptContent) {
                toast.error("Nothing to share yet. Run a transformation first.");
                return;
            }

            (async () => {
                try {
                    await navigator.clipboard.writeText(promptContent);
                } catch (error) {
                    console.warn("Clipboard write failed before handoff", error);
                }

                try {
                    let targetUrl = target.url;
                    let truncated = false;
                    if (target.prefill && target.queryParam) {
                        const joiner = target.url.includes("?") ? "&" : "?";
                        const payload = target.maxLength ? (() => {
                            truncated = promptContent.length > target.maxLength;
                            return promptContent.slice(0, target.maxLength);
                        })() : promptContent;
                        const encoded = encodeURIComponent(payload);
                        targetUrl = `${target.url}${joiner}${target.queryParam}=${encoded}`;
                    }

                    const opened = window.open(targetUrl, "_blank", "noopener,noreferrer");
                    if (!opened) {
                        toast.error("Unable to open the selected assistant. Please allow pop-ups.");
                        return;
                    }

                    if (target.prefill && target.queryParam) {
                        if (truncated) {
                            toast.warning(
                                `Prompt sent to ${target.label}, but it was truncated. Paste from clipboard for the full version.`
                            );
                        } else {
                            toast.success(`Prompt sent to ${target.label}. Paste from clipboard if it doesn't prefill.`);
                        }
                    } else {
                        toast.success(`Prompt copied to clipboard. Paste it into ${target.label} when the tab loads.`);
                    }
                } catch (error) {
                    console.error("Failed to open handoff target:", error);
                    toast.error("Could not open the assistant. Copy the prompt manually.");
                }
            })();
        },
        [getDisplayContent]
    );

    useEffect(() => {
        if (!result) return;
        const content = getDisplayContent();
        updateModeAnalytics(content);
    }, [result]);

    const applyEngineeringTemplate = useCallback((template: EngineeringTemplate) => {
        const prompt = targetProfile === "chatgpt" ? template.chatgpt : template.standard;
        setInputText(prompt);
        setCharCount(prompt.length);
        setResult(null);
        setError(null);
        toast.success(`${template.title} template loaded for ${targetProfile === "chatgpt" ? "ChatGPT" : "Standard"} mode.`);
    }, [targetProfile]);

    const handleInspiration = () => {
        const inspirations = quickTemplates.map((template) =>
            targetProfile === "chatgpt" ? template.chatgpt : template.standard
        );

        const randomInspiration = inspirations[Math.floor(Math.random() * inspirations.length)] ?? "Draft a deployment checklist for our upcoming release.";
        setInputText(randomInspiration);
        setCharCount(randomInspiration.length);
    };

    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    return (
        <>
            <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) handleClose(); }}>
                <DialogContent className="h-[94vh] max-h-[94vh] max-w-[95vw] sm:max-w-[90vw] lg:max-w-[1200px] xl:max-w-[1400px] 2xl:max-w-[1600px] flex flex-col overflow-hidden rounded-3xl border border-border/60 bg-background/95 p-0 shadow-2xl">
                <div className="dialog-content-scrollbar h-full overflow-y-auto">
                    <DialogHeader className="shrink-0 border-b px-6 pb-4 pt-6" data-tour-id="tour-header">
                        <DialogTitle className="flex items-center gap-2">
                            <span className="text-xl">✨</span>
                            Prompt Transformer
                        </DialogTitle>
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                            <DialogDescription className="flex-1">
                                Transform your raw text into a refined AI prompt using advanced prompt engineering.
                                <br />
                                <Badge variant="outline" className="mt-1">
                                    Press double Shift to open this window anytime
                                </Badge>
                            </DialogDescription>
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex items-center gap-1"
                                onClick={runTour}
                            >
                                <HelpCircle className="h-3 w-3" />
                                Tour (Ctrl + H)
                            </Button>
                        </div>
                    </DialogHeader>

                    <div className="flex-1 overflow-hidden px-6 pb-6 pt-4">
                        <div className="grid h-full gap-5 lg:grid-cols-[minmax(0,2.5fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
                            <div className="flex h-full flex-col gap-5 overflow-hidden">
                                <div className="rounded-2xl border bg-card shadow-sm">
                                    <div className="flex items-center justify-between gap-2 border-b px-5 py-4">
                                        <div>
                                            <p className="text-sm font-medium tracking-tight">Prompt Builder</p>
                                            <p className="text-xs text-muted-foreground">
                                                Shape the raw idea and control how the model responds.
                                            </p>
                                        </div>
                                        {isProcessing && (
                                            <Badge variant="secondary" className="animate-pulse">
                                                {isRegenerating ? "Regenerating…" : "Transforming…"}
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="space-y-6 px-6 py-6">
                                        <div className="space-y-3" data-tour-id="tour-raw-prompt">
                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                <h4 className="text-sm font-medium">Raw prompt</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {showResult && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => resetForm()}
                                                        disabled={isProcessing}
                                                    >
                                                        Reset
                                                    </Button>
                                                )}
                                                <Button variant="outline" size="sm" onClick={handleInspiration}>
                                                    Inspiration
                                                </Button>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="outline" size="sm" className="flex items-center gap-1">
                                                                Templates
                                                                <ChevronDown className="h-3 w-3" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-56">
                                                            <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                                                Quick templates
                                                            </DropdownMenuLabel>
                                                            <DropdownMenuSeparator />
                                                            {quickTemplates.map((template) => {
                                                                const previewText = targetProfile === "chatgpt" ? template.chatgpt : template.standard;
                                                                const truncated = previewText.length > 160 ? `${previewText.slice(0, 160)}...` : previewText;
                                                                return (
                                                                    <DropdownMenuItem
                                                                        key={template.id}
                                                                        onSelect={() => applyEngineeringTemplate(template)}
                                                                        className="flex-col items-start gap-1 text-sm"
                                                                    >
                                                                        <span className="font-medium text-foreground">{template.title}</span>
                                                                        <span className="text-[11px] text-muted-foreground line-clamp-2">
                                                                            {truncated}
                                                                        </span>
                                                                    </DropdownMenuItem>
                                                                );
                                                            })}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </div>
                                            <div className="relative">
                                                <Textarea
                                                    ref={inputTextareaRef}
                                                    placeholder="Describe your idea concisely... (e.g., 'Ship a migration plan for multi-tenant billing')."
                                                    value={inputText}
                                                    onChange={(event) => {
                                                        const text = event.target.value.slice(0, MAX_INPUT_LENGTH);
                                                        setInputText(text);
                                                        setCharCount(text.length);
                                                    }}
                                                    className={`min-h-[140px] resize-none font-mono text-sm pr-16 ${
                                                        charCount > MAX_INPUT_LENGTH * 0.95
                                                            ? "text-red-500"
                                                            : charCount > MAX_INPUT_LENGTH * 0.8
                                                                ? "text-yellow-500"
                                                                : "text-gray-500"
                                                    }`}
                                                    disabled={isTransforming}
                                                    maxLength={MAX_INPUT_LENGTH}
                                                />
                                            <div className="pointer-events-none absolute bottom-2 right-3 rounded-full bg-background/90 px-3 py-1 text-[11px] text-muted-foreground shadow-sm">
                                                {charCount}/{MAX_INPUT_LENGTH}
                                            </div>
                                            {inputText && (
                                                <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="absolute top-2 right-2 h-6 w-6"
                                                        onClick={() => {
                                                            setInputText("");
                                                            setCharCount(0);
                                                        }}
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                )}
                                            </div>
                                            {charCount > 0 && (
                                                <div className="mt-3 rounded-xl border bg-muted/40 p-3 text-[11px] text-muted-foreground">
                                                    <div className="flex flex-wrap items-center gap-3">
                                                        <div>
                                                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Prompt tokens</p>
                                                            <p className="text-sm font-semibold text-foreground">
                                                                {tokenMetrics.promptTokens.toLocaleString()}
                                                            </p>
                                                        </div>
                                                        <Separator orientation="vertical" className="hidden h-6 lg:flex" />
                                                        <div>
                                                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Estimated output</p>
                                                            <p className="text-sm font-semibold text-foreground">
                                                                {tokenMetrics.estimatedOutputTokens.toLocaleString()}
                                                            </p>
                                                        </div>
                                                        <Separator orientation="vertical" className="hidden h-6 lg:flex" />
                                                        <div>
                                                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total tokens</p>
                                                            <p className="text-sm font-semibold text-foreground">
                                                                {tokenMetrics.totalTokens.toLocaleString()}
                                                            </p>
                                                        </div>
                                                        <Separator orientation="vertical" className="hidden h-6 lg:flex" />
                                                        <div className="flex items-center gap-2">
                                                            <div>
                                                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Estimated cost</p>
                                                                <p className="text-sm font-semibold text-foreground">
                                                                    ${tokenMetrics.totalCost.toFixed(4)}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <Separator orientation="vertical" className="hidden h-6 lg:flex" />
                                                        <div>
                                                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Complexity</p>
                                                            <p className="text-sm font-semibold text-foreground">
                                                                <Badge
                                                                    variant="outline"
                                                                    className={cn(
                                                                        "px-2 py-0 text-[10px] uppercase tracking-wide",
                                                                        tokenMetrics.complexityClass,
                                                                    )}
                                                                >
                                                                    {tokenMetrics.complexity}
                                                                </Badge>
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            <p className="text-xs text-muted-foreground">
                                                Aim for high-signal context: audience, constraints, done definition, and any links you want the prompt to reference.
                                            </p>
                                            <PromptTransformerFileAttachments
                                                acceptedExtensions={ACCEPTED_EXTENSIONS}
                                                files={uploadedFiles}
                                                onFilesAdded={handleFilesAdded}
                                                onRemoveFile={handleRemoveFile}
                                                onRemoveAll={handleRemoveAll}
                                                onTogglePreview={handleTogglePreview}
                                                onInjectFile={handleInjectFile}
                                                onOptimizeFile={handleOpenOptimizer}
                                            />
                                        </div>

                                        <Separator />

                                        <div className="space-y-3" data-tour-id="tour-system-prompt">
                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                <h4 className="text-sm font-medium">Transformation prompt</h4>
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant={targetProfile === "standard" ? "default" : "outline"}
                                                        size="sm"
                                                        onClick={() => handleProfileChange("standard")}
                                                        disabled={isTransforming}
                                                    >
                                                        Standard
                                                    </Button>
                                                    <Button
                                                        variant={targetProfile === "chatgpt" ? "default" : "outline"}
                                                        size="sm"
                                                        onClick={() => handleProfileChange("chatgpt")}
                                                        disabled={isTransforming}
                                                    >
                                                        ChatGPT
                                                    </Button>
                                                </div>
                                            </div>
                                            <Textarea
                                                value={selectedPrompt}
                                                onChange={(event) => setSelectedPrompt(event.target.value)}
                                                className="min-h-[130px] max-h-[180px] resize-none font-mono text-xs leading-relaxed"
                                                disabled={isTransforming}
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Edit the system prompt to control structure, tone, and safeguards. ChatGPT mode enforces the developer scaffold automatically.
                                            </p>
                                        </div>

                                        <Separator />

                                        <div className="space-y-3" data-tour-id="tour-output-format">
                                            <h4 className="text-sm font-medium">Output format</h4>
                                            <div className="flex flex-wrap gap-2">
                                                <Button
                                                    variant={format === "markdown" ? "default" : "outline"}
                                                    size="sm"
                                                    onClick={() => setFormat("markdown")}
                                                    disabled={isTransforming}
                                                >
                                                    Markdown
                                                </Button>
                                                <Button
                                                    variant={format === "json" ? "default" : "outline"}
                                                    size="sm"
                                                    onClick={() => setFormat("json")}
                                                    disabled={isTransforming || isChatGPT}
                                                    title={isChatGPT ? "JSON output disabled while ChatGPT mode is active" : undefined}
                                                >
                                                    JSON
                                                </Button>
                                            </div>
                                            {isChatGPT && (
                                                <p className="text-xs text-muted-foreground">
                                                    ChatGPT mode outputs rich Markdown with scaffolded sections tailored for conversational agents.
                                                </p>
                                            )}
                                        </div>

                                        {error && (
                                            <div className="flex items-center gap-2 rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" aria-live="assertive">
                                                <AlertCircle className="h-4 w-4" />
                                                {error}
                                            </div>
                                        )}

                                        <div className="flex flex-wrap justify-end gap-2 pt-2">
                                            <Button variant="outline" onClick={handleClose} disabled={isTransforming}>
                                                Cancel
                                            </Button>
                                            <Button onClick={handleTransform} disabled={!inputText.trim() || isTransforming} className="min-w-[180px]">
                                                {isTransforming ? (
                                                    <>
                                                        <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                                                        Transforming...
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="mr-2">✨</span>
                                                        Transform Prompt
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-1 rounded-2xl border bg-card shadow-sm" data-tour-id="tour-output">
                                    <div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-5" data-tour-id="tour-actions">
                                        <div>
                                            <p className="text-sm font-medium tracking-tight">
                                                {showResult ? "Professional Prompt" : "Output preview"}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {showResult
                                                    ? "Review, copy, or export the upgraded prompt before handing it off."
                                                    : "Run a transformation to see the enhanced prompt here."}
                                            </p>
                                        </div>
                                        {showResult && (
                                            <div className="flex flex-wrap gap-2">
                                                <Button variant="outline" size="sm" onClick={() => copyToClipboard(result!.refinedPrompt)}>
                                                    <Copy className="h-3 w-3 mr-1" />
                                                    Copy
                                                </Button>
                                                <Button variant="outline" size="sm" onClick={() => copyAsRTF(getDisplayContent())}>
                                                    <Copy className="h-3 w-3 mr-1" />
                                                    Copy RTF
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                        downloadAsFile(result!.refinedPrompt, `refined-prompt.${result!.format === "markdown" ? "md" : "json"}`)
                                                    }
                                                >
                                                    <Download className="h-3 w-3 mr-1" />
                                                    Export
                                                </Button>
                                                <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={isRegenerating}>
                                                    {isRegenerating ? (
                                                        <>
                                                            <div className="h-3 w-3 mr-1 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                                                            Regenerating...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <RotateCcw className="h-3 w-3 mr-1" />
                                                            Regenerate
                                                        </>
                                                    )}
                                                </Button>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="outline" size="sm" className="flex items-center gap-1">
                                                            <ExternalLink className="h-3 w-3" />
                                                            Open In
                                                            <ChevronDown className="h-3 w-3" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-48">
                                                        {HANDOFF_TARGETS.map((target) => (
                                                            <DropdownMenuItem
                                                                key={target.id}
                                                                onSelect={() => openInProvider(target.id)}
                                                            >
                                                                {target.label}
                                                            </DropdownMenuItem>
                                                        ))}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 px-6 py-6">
                                        {showResult ? (
                                            isRegenerating ? (
                                                <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
                                                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                                                    Updating prompt…
                                                </div>
                                            ) : (
                                                <ScrollArea className="h-full w-full">
                                                    {result!.format === "markdown" ? (
                                                        <div className="prose dark:prose-invert max-w-none">
                                                            <ReactMarkdown components={markdownComponents}>
                                                            {getDisplayContent()}
                                                            </ReactMarkdown>
                                                        </div>
                                                    ) : (
                                                        <div className="text-sm font-mono whitespace-pre-wrap">{getDisplayContent()}</div>
                                                    )}
                                                </ScrollArea>
                                            )
                                        ) : (
                                            <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
                                                <span className="text-base font-medium text-foreground">No prompt yet</span>
                                                <p className="max-w-sm text-center">
                                                    Run a transform to preview the expert-crafted prompt. You can regenerate or pin modes once it renders.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                        {showResult && (
                                    <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/30 px-6 py-4">
                                        <Badge variant="secondary">Format: {result!.format.toUpperCase()}</Badge>
                                        <div className="flex flex-wrap gap-2">
                                            <Button
                                                variant="default"
                                                size="sm"
                                                onClick={addToPrompts}
                                                disabled={isAddingToPrompts}
                                            >
                                                {isAddingToPrompts ? (
                                                    <>
                                                        <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                                                        Saving...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Plus className="h-4 w-4 mr-2" />
                                                        Save Prompt
                                                    </>
                                                )}
                                            </Button>
                                            <Button variant="outline" size="sm" onClick={resetForm} disabled={isAddingToPrompts}>
                                                Clear
                                            </Button>
                        
                                            <Button variant="outline" size="sm" onClick={handleClose} disabled={isAddingToPrompts}>
                                                Close
                                            </Button>
                                        </div>
                                    </div>
                                    )}
                                </div>
                            </div>

                            <aside className="flex h-full flex-col gap-5">
                                <div className="relative min-h-[520px] overflow-hidden">
                                    <div
                                        className={cn(
                                            "absolute inset-0 z-0 transition-all duration-500 ease-in-out",
                                            isActivityVisible
                                                ? "translate-x-full opacity-0 pointer-events-none"
                                                : "translate-x-0 opacity-100"
                                        )}
                                    >
                                        <TemplatesPanel
                                            categories={ENGINEERING_TEMPLATE_CATEGORIES}
                                            mode={targetProfile}
                                            onApply={applyEngineeringTemplate}
                                        />
                                    </div>
                                    <div
                                        className={cn(
                                            "absolute inset-0 z-10 transition-all duration-500 ease-in-out",
                                            isActivityVisible
                                                ? "translate-x-0 opacity-100"
                                                : "translate-x-full opacity-0 pointer-events-none"
                                        )}
                                    >
                                        <ActivityLogPanel
                                            steps={activitySteps}
                                            onBackToTemplates={hideActivityLog}
                                            canDismiss={!isTransforming && !isRegenerating}
                                        />
                                    </div>
                                </div>

                                {isChatGPT && (
                                    <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4" data-tour-id="tour-mode-guidance">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-sm font-medium">Guided mode selection</p>
                                            <Badge variant="outline" className="text-[10px] uppercase">ChatGPT</Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Suggestions refresh as you describe the task. Toggle a mode to pin it into the system prompt.
                                        </p>
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <span className="text-[11px] font-medium uppercase text-muted-foreground">Suggestions</span>
                                                {suggestedModes.length ? (
                                                    <div className="space-y-2">
                                                        {suggestedModes.map((suggestion) => {
                                                            const isActive = forcedModes.includes(suggestion.id);
                                                            return (
                                                                <div key={suggestion.id} className="rounded-lg border border-border/40 bg-background/70 px-3 py-2">
                                                                    <div className="flex items-center justify-between gap-2">
                                                                        <Button
                                                                            variant={isActive ? "default" : "outline"}
                                                                            size="sm"
                                                                            onClick={() => applySuggestion(suggestion.id)}
                                                                            disabled={isTransforming}
                                                                        >
                                                                            {suggestion.id}
                                                                        </Button>
                                                                        <span className="text-[11px] text-muted-foreground">{suggestion.category.toUpperCase()}</span>
                                                                    </div>
                                                                    <p className="mt-2 text-[11px] text-muted-foreground">{suggestion.reason}</p>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <div className="rounded-lg border border-dashed border-border/60 px-3 py-6 text-center text-[11px] text-muted-foreground">
                                                        Add a bit more context above to see recommended thinking modes.
                                                    </div>
                                                )}
                                            </div>
                                            <div className="space-y-2">
                                                <span className="text-[11px] font-medium uppercase text-muted-foreground">Pinned modes</span>
                                                {forcedModes.length ? (
                                                    <div className="flex flex-wrap gap-2">
                                                        {forcedModes.map((mode) => (
                                                            <Badge key={mode} variant="secondary" className="flex items-center gap-1 text-[11px]">
                                                                {mode}
                                                                <button
                                                                    onClick={() => toggleForcedMode(mode)}
                                                                    className="ml-1 text-muted-foreground hover:text-foreground"
                                                                    aria-label={`Remove ${mode}`}
                                                                    type="button"
                                                                    disabled={isTransforming}
                                                                >
                                                                    &times;
                                                                </button>
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-[11px] text-muted-foreground">No modes pinned yet.</p>
                                                )}
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            disabled={isTransforming || availableModes.length === 0}
                                                            className="flex items-center gap-1"
                                                        >
                                                            Add mode
                                                            <ChevronDown className="h-3 w-3" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="start" className="w-64">
                                                        <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                                            Available modes
                                                        </DropdownMenuLabel>
                                                        <DropdownMenuSeparator />
                                                        {availableModes.map((mode) => (
                                                            <DropdownMenuItem
                                                                key={mode.id}
                                                                onSelect={() => toggleForcedMode(mode.id)}
                                                                className="flex-col items-start gap-1 text-sm"
                                                            >
                                                                <span className="font-medium text-foreground">{mode.id}</span>
                                                                <span className="text-[11px] text-muted-foreground">
                                                                    {mode.label}
                                                                </span>
                                                            </DropdownMenuItem>
                                                        ))}
                                                        {availableModes.length === 0 && (
                                                            <DropdownMenuItem disabled className="text-[11px] text-muted-foreground">
                                                                All modes are currently pinned.
                                                            </DropdownMenuItem>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {isChatGPT && modeAnalytics.totalTransforms > 0 && (
                                    <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-3" data-tour-id="tour-mode-analytics">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-sm font-medium">Mode insights</p>
                                            <Badge variant="outline" className="text-[10px] uppercase">Session</Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Tracking {modeAnalytics.totalTransforms} ChatGPT transforms this session.
                                        </p>
                                        {modeAnalytics.lastModes.length > 0 && (
                                            <div className="rounded-lg border border-border/40 bg-background/60 px-3 py-2 text-[11px] text-muted-foreground">
                                                <span className="font-medium text-foreground">Last output:</span> {modeAnalytics.lastModes.join(", ")}
                                            </div>
                                        )}
                                        {topModes.length > 0 && (
                                            <div className="flex flex-wrap gap-2">
                                                {topModes.map(([mode, count]) => (
                                                    <Badge key={mode} variant="outline" className="text-[11px]">
                                                        {mode} · {count}
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </aside>
                        </div>
                    </div>
                </div>
                </DialogContent>
            </Dialog>
            <ContextualOptimizer
                open={optimizerDialogOpen}
                file={optimizerSelectedFile}
                onClose={handleCloseOptimizer}
                onInjectSnippet={handleInjectOptimizerSnippet}
            />
        </>
    );
}

export default PromptTransformer;
