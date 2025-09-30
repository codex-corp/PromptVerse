"use client";

import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Copy, Download, AlertCircle, Plus, RotateCcw, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { toast } from "sonner";

interface PromptTransformerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    authorId: string | null;
    onPromptAdded: () => void;
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

const JSON_PROMPT = `You are a world-class prompt engineer. Your task is to take the user's raw text and transform it into a highly effective, detailed, and clear prompt for a generative AI model. Do not add any conversational fluff, greetings, or explanations. Return ONLY a valid JSON object.
Return the result in the following JSON format:
{
  "title": "Brief title for the prompt",
  "content": "The refined prompt content as a markdown string",
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

const MARKDOWN_PROMPT = `You are a world-class prompt engineer. Your task is to take the user's raw text and transform it into a highly effective, detailed, and clear prompt for a generative AI model. The response should be a markdown string. Do not add any conversational fluff, greetings, or explanations. Return ONLY the refined prompt text in Markdown format.`;

const TEMPLATES = [
    { name: "Blog Post", content: "Write a blog post about [topic] for [audience]. Focus on [key points] and include [style elements]." },
    { name: "Social Media Ad", content: "Create a social media ad for [product/service] targeting [audience]. Use [tone] and highlight [benefits]." },
    { name: "Technical Guide", content: "Explain [technical concept] to [audience level]. Include [key components] and [examples]." }
];

export function PromptTransformer({ open, onOpenChange, authorId, onPromptAdded }: PromptTransformerProps) {
    const [inputText, setInputText] = useState("");
    const [selectedPrompt, setSelectedPrompt] = useState(MARKDOWN_PROMPT);
    const [isTransforming, setIsTransforming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [format, setFormat] = useState<"markdown" | "json">("markdown");
    const [result, setResult] = useState<TransformResult | null>(null);
    const [isAddingToPrompts, setIsAddingToPrompts] = useState(false);
    const [charCount, setCharCount] = useState(0);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        if (format === "json") {
            setSelectedPrompt(JSON_PROMPT);
        } else {
            setSelectedPrompt(MARKDOWN_PROMPT);
        }
    }, [format]);

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

    const handleRegenerate = async () => {
        if (!inputText.trim()) {
            setError("Input text cannot be empty");
            return;
        }

        setError(null);
        setIsRegenerating(true);

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
        if (!result || result.format !== 'json') return;

        setIsAddingToPrompts(true);
        try {
            const promptData: TransformedPrompt = JSON.parse(result.refinedPrompt);

            // Validate required fields
            if (!promptData.title || !promptData.content) {
                throw new Error("Title and content are required fields");
            }

            if (!authorId) {
                throw new Error("Author not found. Please ensure you are logged in.");
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
                    authorId: authorId,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to create prompt");
            }

            const newPrompt = await response.json();

            if (newPrompt) {
                toast.success("Prompt added successfully!");
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

        if (result.format === "json") {
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

    const handleTemplateSelect = (template: string) => {
        setInputText(template);
        setCharCount(template.length);
    };

    const handleInspiration = () => {
        const inspirations = [
            "Write a sci-fi story about quantum teleportation",
            "Create a marketing strategy for a new eco-friendly product",
            "Explain blockchain technology to a 10-year-old",
            "Design a workout plan for busy professionals",
            "Develop a social media campaign for a charity event"
        ];

        const randomInspiration = inspirations[Math.floor(Math.random() * inspirations.length)];
        setInputText(randomInspiration);
        setCharCount(randomInspiration.length);
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
            <DialogContent className="max-w-6xl h-[90vh] max-h-[90vh] flex flex-col overflow-hidden">
                <div className="dialog-content-scrollbar h-full overflow-y-auto">
                    <DialogHeader className="shrink-0 pb-2">
                        <DialogTitle className="flex items-center gap-2">
                            <span className="text-xl">✨</span>
                            Prompt Transformer
                        </DialogTitle>
                        <DialogDescription>
                            Transform your raw text into a refined AI prompt using advanced prompt engineering.
                            <br />
                            <Badge variant="outline" className="mt-1">
                                Press double Shift to open this window anytime
                            </Badge>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 flex flex-col gap-4 overflow-hidden p-1">
                        {!result ? (
                            <div className="flex-1 flex flex-col gap-4">
                                {/* Input Section */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-medium">Enter your raw prompt here:</h4>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleInspiration}
                                            >
                                                Inspiration
                                            </Button>
                                            <select
                                                value=""
                                                onChange={(e) => {
                                                    if (e.target.value) handleTemplateSelect(e.target.value);
                                                    e.target.value = "";
                                                }}
                                                className="text-xs border rounded px-2 py-1"
                                            >
                                                <option value="">Quick Templates</option>
                                                {TEMPLATES.map((template) => (
                                                    <option key={template.name} value={template.content}>
                                                        {template.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="relative">
                                        <Textarea
                                            placeholder="Describe your idea concisely... (e.g., 'Write a blog post about AI ethics')."
                                            value={inputText}
                                            onChange={(e) => {
                                                const text = e.target.value;
                                                if (text.length <= 1000) {
                                                    setInputText(text);
                                                    setCharCount(text.length);
                                                }
                                            }}
                                            className={`min-h-[120px] max-h-[200px] resize-none font-mono text-sm ${
                                                charCount > 900 ? "text-red-500" :
                                                    charCount > 700 ? "text-yellow-500" : "text-gray-500"
                                            }`}
                                            disabled={isTransforming}
                                        />
                                        <div className="absolute bottom-2 right-2 text-xs">
                      <span className={charCount > 900 ? "text-red-500" : charCount > 700 ? "text-yellow-500" : "text-gray-500"}>
                        {charCount}/1000
                      </span>
                                            {inputText && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-4 w-4 ml-2"
                                                    onClick={() => {
                                                        setInputText("");
                                                        setCharCount(0);
                                                    }}
                                                >
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
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
                                        className="min-w-[180px]"
                                    >
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
                        ) : (
                            <div className="flex-1 flex flex-col">
                                {/* Result Section */}
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-medium">Professional Prompt</h4>
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
                                            Export
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleRegenerate}
                                            disabled={isRegenerating}
                                        >
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
                                    </div>
                                </div>

                                <div className="flex-1 border rounded-md p-4 bg-background overflow-y-auto">
                                    {isRegenerating ? (
                                        <div className="h-full flex flex-col items-center justify-center">
                                            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mb-4"></div>
                                            <p className="text-muted-foreground">Regenerating prompt...</p>
                                        </div>
                                    ) : (
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
                                    )}
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
                                            disabled={isAddingToPrompts || result.format === 'markdown'}
                                        >
                                            {isAddingToPrompts ? (
                                                <>
                                                    <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
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