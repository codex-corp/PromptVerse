"use client";

import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Copy, Download, Send, Wand2, Sparkles, AlertCircle, Plus } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { toast } from "sonner";

interface PromptTransformerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

interface TransformResult {
    refinedPrompt: string;
    format: "markdown" | "json";
}

interface TransformedPrompt {
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

const DEFAULT_PROMPT = `You are a world-class prompt engineer. Your task is to take the user's raw text and transform it into a highly effective, detailed, and clear prompt for a generative AI model. Do not add any conversational fluff, greetings, or explanations. Return ONLY the refined prompt text.

Return the result in the following JSON format:
{
  "title": "Brief title for the prompt",
  "content": "The refined prompt content",
  "description": "Optional description of what the prompt does",
  "targetModel": "gpt-4",
  "temperature": 0.7,
  "maxTokens": 1024,
  "topP": 1,
  "frequencyPenalty": 0,
  "presencePenalty": 0,
  "notes": "Any additional notes",
  "tags": ["tag1", "tag2"],
  "category": "Category name"
}`;

export function PromptTransformer({ open, onOpenChange }: PromptTransformerProps) {
    const [inputText, setInputText] = useState("");
    const [selectedPrompt, setSelectedPrompt] = useState(DEFAULT_PROMPT);
    const [isTransforming, setIsTransforming] = useState(false);
    const [result, setResult] = useState<TransformResult | null>(null);
    const [format, setFormat] = useState<"markdown" | "json">("markdown");
    const [error, setError] = useState<string | null>(null);
    const [isAddingToPrompts, setIsAddingToPrompts] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Handle keyboard shortcut
    useEffect(() => {
        let shiftPressCount = 0;
        let lastShiftTime = 0;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Shift") {
                const now = Date.now();

                // Reset counter if more than 500ms passed since last shift
                if (now - lastShiftTime > 500) {
                    shiftPressCount = 0;
                }

                shiftPressCount++;
                lastShiftTime = now;

                // If double shift detected
                if (shiftPressCount === 2) {
                    e.preventDefault();
                    onOpenChange(true);
                    shiftPressCount = 0; // Reset after action
                }
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [onOpenChange]);

    const handleTransform = async () => {
        if (!inputText.trim()) {
            setError("Input text cannot be empty");
            return;
        }

        setError(null);
        setIsTransforming(true);

        // Cancel any previous requests
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            // Call the custom OpenAI-like API endpoint
            const response = await fetch("/api/transform-prompt", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    inputText,
                    systemPrompt: selectedPrompt,
                    format,
                }),
                signal: controller.signal,
            });

            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(errorData || "Failed to transform prompt");
            }

            const data = await response.json();
            setResult({
                refinedPrompt: data.refinedPrompt,
                format,
            });
        } catch (error: any) {
            if (error.name === "AbortError") {
                console.log("Request was cancelled");
                return;
            }

            console.error("Error transforming prompt:", error);
            setError(error.message || "An error occurred while transforming the prompt");
            toast.error(error.message || "Failed to transform prompt");
        } finally {
            setIsTransforming(false);
            abortControllerRef.current = null;
        }
    };

    const copyToClipboard = async (text: string) => {
        try {
            // Extract content from result based on format
            let contentToCopy = text;

            if (format === "json") {
                try {
                    const parsed = JSON.parse(text);
                    contentToCopy = parsed.content || text;
                } catch (e) {
                    // If parsing fails, use original text
                    contentToCopy = text;
                }
            } else {
                // For markdown, look for ```json block
                const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
                if (jsonMatch) {
                    try {
                        const parsed = JSON.parse(jsonMatch[1]);
                        contentToCopy = parsed.content || text;
                    } catch (e) {
                        // If parsing fails, use original text
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
            let promptData: TransformedPrompt;

            if (format === "json") {
                try {
                    promptData = JSON.parse(result.refinedPrompt);
                } catch (e) {
                    throw new Error("Invalid JSON response from API");
                }
            } else {
                // If it's markdown, we need to extract JSON from code blocks
                const jsonMatch = result.refinedPrompt.match(/```json\n([\s\S]*?)\n```/);
                if (jsonMatch) {
                    promptData = JSON.parse(jsonMatch[1]);
                } else {
                    throw new Error("No JSON found in response");
                }
            }

            // Validate required fields
            if (!promptData.title || !promptData.content) {
                throw new Error("Title and content are required fields");
            }

            // Call the API endpoint to create the prompt
            const response = await fetch("/api/prompts", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    title: promptData.title,
                    content: promptData.content,
                    description: promptData.description,
                    targetModel: promptData.targetModel || "gpt-4",
                    temperature: promptData.temperature,
                    maxTokens: promptData.maxTokens,
                    topP: promptData.topP,
                    frequencyPenalty: promptData.frequencyPenalty,
                    presencePenalty: promptData.presencePenalty,
                    notes: promptData.notes,
                    tags: promptData.tags,
                    categoryId: promptData.category ? promptData.category : null,
                    authorId: "current-user-id", // Replace with actual user ID
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to create prompt");
            }

            const newPrompt = await response.json();

            if (newPrompt) {
                toast.success("Prompt added successfully!");
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
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
    };

    const handleClose = () => {
        resetForm();
        onOpenChange(false);
    };

    // Helper function to extract content from result
    const getDisplayContent = () => {
        if (!result) return "";

        if (format === "json") {
            try {
                const parsed = JSON.parse(result.refinedPrompt);
                return parsed.content || result.refinedPrompt;
            } catch (e) {
                return result.refinedPrompt; // fallback to raw
            }
        }

        // For markdown, look for ```json block
        const jsonMatch = result.refinedPrompt.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[1]);
                return parsed.content || result.refinedPrompt;
            } catch (e) {
                return result.refinedPrompt;
            }
        }

        return result.refinedPrompt;
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-4xl h-[80vh] max-h-[80vh] flex flex-col overflow-hidden">
                <div className="dialog-content-scrollbar h-full overflow-y-auto">
                    <DialogHeader className="shrink-0 pb-2">
                        <DialogTitle className="flex items-center gap-2">
                            <Wand2 className="h-5 w-5" />
                            <Sparkles className="h-4 w-4 text-primary" />
                            Prompt Transformer
                        </DialogTitle>
                        <DialogDescription>
                            Transform your raw text into a refined AI prompt using advanced prompt engineering.
                            <br />
                            <Badge variant="outline" className="mt-1">
                                Press Ctrl+Alt+Space to open this window anytime
                            </Badge>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 flex flex-col gap-4 overflow-hidden p-1">
                        {!result ? (
                            <div className="flex-1 flex flex-col gap-4">
                                {/* Input Section */}
                                <div className="space-y-3">
                                    <h4 className="text-sm font-medium">Your Raw Text</h4>
                                    <Textarea
                                        placeholder="Paste your raw text here that you want to transform into a refined prompt..."
                                        value={inputText}
                                        onChange={(e) => setInputText(e.target.value)}
                                        className="min-h-[150px] resize-none font-mono text-sm max-h-[200px] overflow-y-auto"
                                        disabled={isTransforming}
                                    />
                                </div>

                                <Separator />

                                {/* System Prompt Selection */}
                                <div className="space-y-3">
                                    <h4 className="text-sm font-medium">Transformation Prompt</h4>
                                    <div className="relative">
                                        <Textarea
                                            value={selectedPrompt}
                                            onChange={(e) => setSelectedPrompt(e.target.value)}
                                            className="min-h-[130px] resize-none font-mono text-sm max-h-[150px] overflow-y-auto"
                                            disabled={isTransforming}
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        This is the system prompt that will guide the AI transformation process.
                                    </p>
                                </div>

                                <Separator />

                                {/* Format Selection */}
                                <div className="space-y-3">
                                    <h4 className="text-sm font-medium">Output Format</h4>
                                    <div className="flex gap-2">
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
                                            disabled={isTransforming}
                                        >
                                            JSON
                                        </Button>
                                    </div>
                                </div>

                                {/* Error Display */}
                                {error && (
                                    <div className="flex items-center gap-2 text-destructive text-sm p-2 bg-destructive/10 rounded-md">
                                        <AlertCircle className="h-4 w-4" />
                                        {error}
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex justify-end gap-2 pt-4">
                                    <Button variant="outline" onClick={handleClose} disabled={isTransforming}>
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleTransform}
                                        disabled={!inputText.trim() || isTransforming}
                                        className="min-w-[120px]"
                                    >
                                        {isTransforming ? (
                                            <>
                                                <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                                                Transforming...
                                            </>
                                        ) : (
                                            <>
                                                <Send className="h-4 w-4 mr-2" />
                                                Transform
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col">
                                {/* Result Section */}
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-medium">Transformed Prompt</h4>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => copyToClipboard(result.refinedPrompt)}
                                        >
                                            <Copy className="h-3 w-3 mr-1" />
                                            Copy
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => downloadAsFile(
                                                result.refinedPrompt,
                                                `refined-prompt.${result.format === "markdown" ? "md" : "json"}`
                                            )}
                                        >
                                            <Download className="h-3 w-3 mr-1" />
                                            Download
                                        </Button>
                                    </div>
                                </div>

                                <div className="flex-1 border rounded-md p-4 bg-background overflow-y-auto">
                                    <ScrollArea className="h-full w-full">
                                        {result.format === "markdown" ? (
                                            <div className="prose dark:prose-invert max-w-none">
                                                <ReactMarkdown
                                                    components={{
                                                        code({ node, inline, className, children, ...props }) {
                                                            const match = /language-(\w+)/.exec(className || "");
                                                            return !inline && match ? (
                                                                <SyntaxHighlighter
                                                                    style={atomDark}
                                                                    language={match[1]}
                                                                    PreTag="div"
                                                                    {...props}
                                                                >
                                                                    {String(children).replace(/\n$/, "")}
                                                                </SyntaxHighlighter>
                                                            ) : (
                                                                <code className={className} {...props}>
                                                                    {children}
                                                                </code>
                                                            );
                                                        },
                                                    }}
                                                >
                                                    {getDisplayContent()}
                                                </ReactMarkdown>
                                            </div>
                                        ) : (
                                            <div className="text-sm font-mono whitespace-pre-wrap">
                                                {getDisplayContent()}
                                            </div>
                                        )}
                                    </ScrollArea>
                                </div>

                                <div className="mt-3 flex items-center justify-between">
                                    <Badge variant="secondary">
                                        Format: {result.format.toUpperCase()}
                                    </Badge>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={resetForm}
                                            disabled={isAddingToPrompts}
                                        >
                                            Again?
                                        </Button>
                                        <Button
                                            onClick={addToPrompts}
                                            disabled={isAddingToPrompts}
                                        >
                                            {isAddingToPrompts ? (
                                                <>
                                                    <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                                                    Adding...
                                                </>
                                            ) : (
                                                <>
                                                    <Plus className="h-4 w-4 mr-2" />
                                                    Add To Prompts
                                                </>
                                            )}
                                        </Button>
                                        <Button onClick={handleClose} disabled={isAddingToPrompts}>
                                            Done
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}