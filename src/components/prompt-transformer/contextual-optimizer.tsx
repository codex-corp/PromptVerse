"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { UploadedFileState } from "./file-attachments";
import { Copy, Loader2, Sparkles } from "lucide-react";

const OPTIMIZER_FILE_CONTENT_LIMIT = 3_000;
const MAX_STORED_MESSAGES = 40;
const MAX_MESSAGES_FOR_PAYLOAD = 12;
const REQUEST_TIMEOUT_MS = 25_000;
const REQUEST_RETRIES = 1;
const REQUEST_RETRY_DELAY_MS = 800;

const SNIPPET_SYSTEM_PROMPT =
    "You are an AI assistant helping a user extract a specific snippet of text from a larger document. Your goal is to understand the user's request, ask clarifying questions if needed, and then return ONLY the single, most relevant code or text snippet that matches their request. Format your final response as one concise directive sentence (referencing the relevant file name if provided and guiding downstream usage without repeating the user's wording verbatim) immediately followed by a fenced code block that contains only the extracted snippet. Do not include any additional commentary before or after the directive and code block.";

type OptimizerMessage = {
    id: string;
    role: "assistant" | "user";
    content: string;
    status?: "thinking";
    isSnippet?: boolean;
    kind?: "greeting";
};

const estimateTokens = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed.length) {
        return 0;
    }
    return Math.max(1, Math.ceil(trimmed.length / 4));
};

const extractSnippetSections = (content: string) => {
    const text = content?.trim() ?? "";
    if (!text) {
        return { directive: "", language: "", code: "" };
    }

    const fenceRegex = /(```|~~~)([^\n]*)\n([\s\S]*?)\n\1/gm;
    const matches: Array<{ start: number; end: number; lang: string; body: string }> = [];
    let match: RegExpExecArray | null;

    while ((match = fenceRegex.exec(text))) {
        const lang = (match[2] || "").trim();
        const body = (match[3] || "").trim();
        matches.push({ start: match.index, end: fenceRegex.lastIndex, lang, body });
    }

    if (matches.length === 0) {
        return { directive: "", language: "", code: text };
    }

    const best = matches.reduce((prev, current) => (current.body.length > prev.body.length ? current : prev), matches[0]);
    const directive = text.slice(0, best.start).trim();
    const language = best.lang;
    const code = best.body;

    return { directive, language, code: code || text };
};

const createMessageId = () =>
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);

type FilePreviewDetails = {
    previewText: string;
    previewCharCount: number;
    totalCharCount: number;
    isTruncated: boolean;
    previewTokenEstimate: number;
};

const getFilePreviewDetails = (file: UploadedFileState | null): FilePreviewDetails | null => {
    if (!file || typeof file.content !== "string") {
        return null;
    }

    const content = file.content;
    const isTruncated = content.length > OPTIMIZER_FILE_CONTENT_LIMIT;
    const sliceLength = Math.min(content.length, OPTIMIZER_FILE_CONTENT_LIMIT);
    const previewCore = content.slice(0, sliceLength);
    const previewText = isTruncated ? `${previewCore}…` : previewCore;

    return {
        previewText,
        previewCharCount: sliceLength,
        totalCharCount: content.length,
        isTruncated,
        previewTokenEstimate: estimateTokens(previewText),
    };
};

const buildConversationPayload = ({
    file,
    messages,
    preview,
}: {
    file: UploadedFileState;
    messages: OptimizerMessage[];
    preview: FilePreviewDetails | null;
}) => {
    const contextSections: string[] = [
        `File name: ${file.name}`,
    ];

    if (typeof file.size === "number") {
        contextSections.push(`File size: ${file.size} bytes`);
    }

    if (preview) {
        contextSections.push(
            [
                `File content (first ${preview.previewCharCount.toLocaleString()} of ${preview.totalCharCount.toLocaleString()} characters${
                    preview.isTruncated ? ", truncated" : ""
                }):`,
                preview.previewText,
            ].join("\n")
        );
    }

    const recentMessages = messages.slice(-MAX_MESSAGES_FOR_PAYLOAD);
    const conversation = recentMessages
        .map((message) => {
            const speaker = message.role === "assistant" ? "Assistant" : "User";
            return `${speaker}: ${message.content.trim()}`;
        })
        .join("\n");

    return [
        contextSections.join("\n"),
        "",
        "Conversation history:",
        conversation,
        "",
        "Respond with the exact snippet that satisfies the latest user request.",
    ]
        .filter(Boolean)
        .join("\n");
};

export type OptimizerSnippetPayload = {
    snippet: string;
    file: UploadedFileState | null;
    userRequest?: string;
};

export type ContextualOptimizerProps = {
    open: boolean;
    file: UploadedFileState | null;
    onClose: () => void;
    onInjectSnippet: (payload: OptimizerSnippetPayload) => void;
    clearOnClose?: boolean;
};

const trimMessages = (messages: OptimizerMessage[]) => {
    if (messages.length <= MAX_STORED_MESSAGES) {
        return messages;
    }

    const startIndex = messages.length - MAX_STORED_MESSAGES;
    const trimmed = messages.slice(startIndex);
    const greeting = messages.find((message) => message.kind === "greeting");

    if (greeting && !trimmed.some((message) => message.id === greeting.id)) {
        return [greeting, ...trimmed];
    }

    return trimmed;
};

const ContextualOptimizer = ({ open, file, onClose, onInjectSnippet, clearOnClose = true }: ContextualOptimizerProps) => {
    const [messages, setMessages] = useState<OptimizerMessage[]>([]);
    const [inputValue, setInputValue] = useState("");
    const [isThinking, setIsThinking] = useState(false);
    const transcriptRef = useRef<HTMLDivElement | null>(null);
    const abortRef = useRef<AbortController | null>(null);
    const messagesRef = useRef<OptimizerMessage[]>([]);

    const commitMessages = useCallback((updater: (prev: OptimizerMessage[]) => OptimizerMessage[]) => {
        setMessages((prev) => {
            const next = trimMessages(updater(prev));
            messagesRef.current = next;
            return next;
        });
    }, []);

    const greeting = useMemo(() => {
        if (!file) {
            return "I'm ready to help you extract the snippet you need.";
        }

        return `I'm ready to help you extract the snippet you need from ${file.name}.`;
    }, [file]);

    const suggestionPrompts = useMemo(() => {
        if (!file) {
            return [
                "Find the section describing the deployment steps",
                "Share the function that handles authentication",
                "Show me any TODO comments"
            ];
        }

        return [
            `Extract the primary code snippet that defines the core logic in ${file.name}`,
            "Locate any TODO or FIXME notes",
            "Give me the configuration block with API keys removed"
        ];
    }, [file]);

    const filePreviewDetails = useMemo(() => getFilePreviewDetails(file), [file]);

    useEffect(() => {
        if (!open) {
            if (abortRef.current) {
                abortRef.current.abort();
                abortRef.current = null;
            }
            setInputValue("");
            setIsThinking(false);
            if (clearOnClose) {
                commitMessages(() => []);
                messagesRef.current = [];
            }
            return;
        }

        setIsThinking(false);
        setInputValue("");
        commitMessages((prev) => {
            if (prev.length === 0) {
                return [
                    {
                        id: createMessageId(),
                        role: "assistant",
                        content: greeting,
                        kind: "greeting",
                    },
                ];
            }

            return prev.map((message) =>
                message.kind === "greeting"
                    ? {
                          ...message,
                          content: greeting,
                      }
                    : message
            );
        });
    }, [open, greeting, clearOnClose, commitMessages]);

    useEffect(() => {
        if (!open) {
            return;
        }

        const container = transcriptRef.current;
        if (!container) {
            return;
        }

        container.scrollTop = container.scrollHeight;
    }, [messages, open]);

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    const composeAbortSignals = useCallback((signals: AbortSignal[]) => {
        const activeSignals = signals.filter(Boolean) as AbortSignal[];
        if (activeSignals.length === 0) {
            return undefined;
        }

        if (activeSignals.length === 1) {
            return activeSignals[0];
        }

        if (typeof AbortSignal !== "undefined" && typeof AbortSignal.any === "function") {
            return AbortSignal.any(activeSignals);
        }

        const controller = new AbortController();
        const abort = () => controller.abort();

        for (const signal of activeSignals) {
            if (signal.aborted) {
                abort();
                break;
            }
            signal.addEventListener("abort", abort, { once: true });
        }

        return controller.signal;
    }, []);

    const fetchJsonWithTimeoutAndRetry = useCallback(
        async <T,>(
            input: RequestInfo | URL,
            init: RequestInit & { signal?: AbortSignal },
            { timeoutMs, retries, retryDelayMs }: { timeoutMs: number; retries: number; retryDelayMs: number }
        ): Promise<T> => {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), timeoutMs);

            const combinedSignal = composeAbortSignals([controller.signal, init.signal].filter(Boolean) as AbortSignal[]);

            try {
                let lastError: unknown = null;

                for (let attempt = 0; attempt <= retries; attempt++) {
                    try {
                        const response = await fetch(input, { ...init, signal: combinedSignal });
                        if (!response.ok) {
                            throw Object.assign(new Error(`Optimizer request failed: ${response.status}`), {
                                status: response.status,
                            });
                        }
                        return (await response.json()) as T;
                    } catch (error) {
                        lastError = error;
                        const status = typeof (error as any)?.status === "number" ? (error as any).status : undefined;
                        const message = (error as Error)?.message?.toLowerCase?.() ?? "";
                        const isTransient =
                            (status !== undefined && status >= 500) ||
                            (error as any)?.name === "AbortError" ||
                            message.includes("network") ||
                            message.includes("timeout");

                        if (attempt < retries && isTransient) {
                            await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
                            continue;
                        }
                        throw error;
                    }
                }

                throw lastError ?? new Error("Unknown optimizer error");
            } finally {
                clearTimeout(timeout);
            }
        },
        [composeAbortSignals]
    );

    const handleSubmit = useCallback(
        async (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            const trimmed = inputValue.trim();
            if (!trimmed) {
                return;
            }

            if (!file) {
                toast.error("Select a file to optimize.");
                return;
            }

            const userMessage: OptimizerMessage = {
                id: createMessageId(),
                role: "user",
                content: trimmed,
            };

            const thinkingMessage: OptimizerMessage = {
                id: createMessageId(),
                role: "assistant",
                content: "Thinking…",
                status: "thinking",
            };

            const payloadMessages = [...messagesRef.current.filter((message) => message.status !== "thinking"), userMessage];
            const requestBody = buildConversationPayload({
                file,
                messages: payloadMessages,
                preview: filePreviewDetails,
            });

            commitMessages((prev) => [...prev, userMessage, thinkingMessage]);
            setInputValue("");
            setIsThinking(true);

            if (abortRef.current) {
                abortRef.current.abort();
            }

            const controller = new AbortController();
            abortRef.current = controller;

            try {
                const data = await fetchJsonWithTimeoutAndRetry<{ refinedPrompt?: string }>(
                    "/api/transform-prompt",
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            inputText: requestBody,
                            systemPrompt: SNIPPET_SYSTEM_PROMPT,
                            format: "markdown",
                        }),
                        signal: controller.signal,
                    },
                    {
                        timeoutMs: REQUEST_TIMEOUT_MS,
                        retries: REQUEST_RETRIES,
                        retryDelayMs: REQUEST_RETRY_DELAY_MS,
                    }
                );

                const snippet = typeof data.refinedPrompt === "string" ? data.refinedPrompt.trim() : "";

                if (!snippet) {
                    throw new Error("The assistant response was empty.");
                }

                commitMessages((prev) =>
                    prev.map((message) =>
                        message.id === thinkingMessage.id
                            ? {
                                  ...message,
                                  content: snippet,
                                  status: undefined,
                                  isSnippet: true,
                              }
                            : message
                    )
                );
            } catch (error) {
                if ((error as Error).name === "AbortError") {
                    return;
                }

                console.error(error);
                commitMessages((prev) =>
                    prev.map((message) =>
                        message.id === thinkingMessage.id
                            ? {
                                  ...message,
                                  content: "Unable to retrieve a snippet. Please try again.",
                                  status: undefined,
                              }
                            : message
                    )
                );
                toast.error("Optimizer request failed. Please try again.");
            } finally {
                setIsThinking(false);
                if (abortRef.current === controller) {
                    abortRef.current = null;
                }
            }
        },
        [file, inputValue, filePreviewDetails, commitMessages, fetchJsonWithTimeoutAndRetry]
    );

    const handleInjectSnippet = useCallback(
        (message: OptimizerMessage) => {
            const snippet = message.content.trim();
            if (!snippet) {
                toast.error("No snippet available to inject.");
                return;
            }

            const lastUserMessage = [...messagesRef.current]
                .reverse()
                .find((entry) => entry.role === "user");

            onInjectSnippet({
                snippet,
                file,
                userRequest: lastUserMessage?.content.trim() || undefined,
            });
        },
        [file, onInjectSnippet]
    );

    const handleCopySnippet = useCallback(async (message: OptimizerMessage) => {
        const snippet = message.content.trim();
        if (!snippet) {
            toast.error("No snippet available to copy.");
            return;
        }

        if (!navigator?.clipboard?.writeText) {
            toast.error("Clipboard API is unavailable.");
            return;
        }

        try {
            await navigator.clipboard.writeText(snippet);
            toast.success("Snippet copied to clipboard.");
        } catch (error) {
            console.error(error);
            toast.error("Unable to copy snippet.");
        }
    }, []);

    return (
        <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
            <DialogContent className="max-w-[520px] rounded-2xl p-0">
                <DialogHeader className="border-b px-6 py-4">
                    <DialogTitle>Optimize Context</DialogTitle>
                    <DialogDescription asChild>
                        <div className="space-y-1 text-sm text-muted-foreground">
                            <p className="text-sm text-foreground">
                                {file
                                    ? `Chat with the assistant to extract snippets from ${file.name}.`
                                    : "Chat with the assistant to extract the snippet you need."}
                            </p>
                            {filePreviewDetails && file ? (
                                <p className="text-[11px] text-muted-foreground">
                                    Using first {filePreviewDetails.previewCharCount.toLocaleString()} of {" "}
                                    {filePreviewDetails.totalCharCount.toLocaleString()} characters (~
                                    {filePreviewDetails.previewTokenEstimate.toLocaleString()} tokens) from {file.name}.
                                </p>
                            ) : null}
                        </div>
                    </DialogDescription>
                </DialogHeader>
                <div className="flex h-[500px] flex-col gap-4 px-6 py-4">
                    <div
                        ref={transcriptRef}
                        className="flex-1 space-y-3 overflow-y-auto pr-1"
                        aria-live="polite"
                        aria-label="Context optimizer conversation"
                        aria-busy={isThinking}
                    >
                        {messages.length === 0 ? (
                            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                                Start a conversation to locate the exact snippet you need.
                            </div>
                        ) : (
                            messages.map((message) => {
                                const isAssistant = message.role === "assistant";
                                const snippetSections = message.isSnippet
                                    ? extractSnippetSections(message.content)
                                    : null;
                                const snippetCode = snippetSections
                                    ? snippetSections.code
                                    : message.content.trim();
                                const snippetCharCount = message.isSnippet ? snippetCode.length : 0;
                                const snippetTokenEstimate = message.isSnippet ? estimateTokens(snippetCode) : 0;
                                const snippetFootnote = message.isSnippet
                                    ? [
                                          `${snippetCharCount.toLocaleString()} chars (~${snippetTokenEstimate.toLocaleString()} tokens)`,
                                          snippetSections?.language ? `language: ${snippetSections.language}` : null,
                                      ]
                                          .filter(Boolean)
                                          .join(" • ")
                                    : "";
                                return (
                                    <div
                                        key={message.id}
                                        className={cn("flex", isAssistant ? "justify-start" : "justify-end")}
                                    >
                                        <div
                                            className={cn(
                                                "flex max-w-[85%] min-w-0 flex-col gap-3 rounded-2xl px-4 py-3 text-sm shadow-sm break-words",
                                                isAssistant
                                                    ? "bg-muted/70 text-foreground"
                                                    : "bg-primary text-primary-foreground"
                                            )}
                                        >
                                            {message.isSnippet ? (
                                                <div className="space-y-3">
                                            {snippetSections?.directive && (
                                                <div className="flex items-start gap-2 text-xs">
                                                    <Sparkles className="mt-0.5 h-3 w-3 flex-shrink-0 text-primary" aria-hidden="true" />
                                                    <p className="font-medium text-muted-foreground break-words">
                                                        {snippetSections.directive}
                                                    </p>
                                                </div>
                                            )}
                                            <pre
                                                className="max-h-[220px] overflow-auto rounded-lg bg-background/80 p-3 font-mono text-xs shadow-inner whitespace-pre-wrap break-words"
                                                        data-language={snippetSections?.language || undefined}
                                                    >
                                                        <code className="whitespace-pre-wrap break-words">
                                                            {snippetSections?.code ?? message.content.trim()}
                                                        </code>
                                                    </pre>
                                                    {snippetFootnote ? (
                                                        <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                                                            {snippetSections?.language && (
                                                                <Badge variant="outline" className="px-2 py-0 text-[10px] uppercase tracking-wide">
                                                                    {snippetSections.language}
                                                                </Badge>
                                                            )}
                                                            <span>{snippetFootnote}</span>
                                                        </div>
                                                    ) : null}
                                                    <div className="flex flex-wrap gap-2">
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleCopySnippet(message)}
                                                            aria-label="Copy snippet to clipboard"
                                                        >
                                                            <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
                                                            Copy
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="secondary"
                                                            className="self-start"
                                                            onClick={() => handleInjectSnippet(message)}
                                                            aria-label="Inject snippet into raw prompt"
                                                        >
                                                            Inject Snippet
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                            <div
                                                className={cn(
                                                    "flex items-start gap-2 leading-relaxed whitespace-pre-wrap break-words",
                                                    isAssistant ? "text-foreground" : "text-primary-foreground"
                                                )}
                                            >
                                                {message.status === "thinking" ? (
                                                    <Loader2 className="mt-0.5 h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden="true" />
                                                ) : isAssistant ? (
                                                    <Sparkles className="mt-0.5 h-3.5 w-3.5 text-primary" aria-hidden="true" />
                                                ) : null}
                                                <p
                                                    className={cn(
                                                        "flex-1",
                                                        message.status === "thinking" && "italic text-muted-foreground"
                                                    )}
                                                >
                                                    {message.content}
                                                </p>
                                            </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-3">
                        <Textarea
                            value={inputValue}
                            onChange={(event) => setInputValue(event.target.value)}
                            placeholder={
                                file
                                    ? `Ask for the snippet you need from ${file.name}...`
                                    : "Describe the snippet you need..."
                            }
                            rows={3}
                            disabled={isThinking}
                            aria-label={
                                file
                                    ? `Describe the snippet you need from ${file.name}`
                                    : "Describe the snippet you need"
                            }
                        />
                        <div className="flex flex-col gap-1 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                            <span>Press Enter to send · Shift + Enter for a new line</span>
                            {isThinking && (
                                <span className="flex items-center gap-1">
                                    <Loader2 className="h-3 w-3 animate-spin" /> Assistant is thinking
                                </span>
                            )}
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onClose}
                                disabled={isThinking}
                                aria-label="Close optimizer"
                            >
                                Close
                            </Button>
                            <Button
                                type="submit"
                                disabled={isThinking || !inputValue.trim() || !file}
                                aria-label={isThinking ? "Assistant is thinking" : "Send message"}
                            >
                                {isThinking ? "Thinking…" : "Send"}
                            </Button>
                        </div>
                    </form>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ContextualOptimizer;
