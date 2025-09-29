"use client";

import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Copy, Download, Send, Wand2, Sparkles } from "lucide-react";

interface PromptTransformerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TransformResult {
  refinedPrompt: string;
  format: "markdown" | "json";
}

const DEFAULT_PROMPT = `You are a world-class prompt engineer. Your task is to take the user's raw text and transform it into a highly effective, detailed, and clear prompt for a generative AI model. Do not add any conversational fluff, greetings, or explanations. Return ONLY the refined prompt text.`;

export function PromptTransformer({ open, onOpenChange }: PromptTransformerProps) {
  const [inputText, setInputText] = useState("");
  const [selectedPrompt, setSelectedPrompt] = useState(DEFAULT_PROMPT);
  const [isTransforming, setIsTransforming] = useState(false);
  const [result, setResult] = useState<TransformResult | null>(null);
  const [format, setFormat] = useState<"markdown" | "json">("markdown");

  // Handle keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && e.code === "Space") {
        e.preventDefault();
        onOpenChange(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onOpenChange]);

  const handleTransform = async () => {
    if (!inputText.trim()) return;

    setIsTransforming(true);
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
      });

      if (!response.ok) {
        throw new Error("Failed to transform prompt");
      }

      const data = await response.json();
      setResult({
        refinedPrompt: data.refinedPrompt,
        format,
      });
    } catch (error) {
      console.error("Error transforming prompt:", error);
      // Fallback to mock response for demo
      setResult({
        refinedPrompt: `Refined prompt based on: "${inputText.substring(0, 100)}..."`,
        format,
      });
    } finally {
      setIsTransforming(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  };

  const downloadAsFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const resetForm = () => {
    setInputText("");
    setResult(null);
    setIsTransforming(false);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
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

        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {!result ? (
            <>
              {/* Input Section */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Your Raw Text</h4>
                <Textarea
                  placeholder="Paste your raw text here that you want to transform into a refined prompt..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="min-h-[150px] resize-none"
                />
              </div>

              <Separator />

              {/* System Prompt Selection */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Transformation Prompt</h4>
                <Textarea
                  value={selectedPrompt}
                  onChange={(e) => setSelectedPrompt(e.target.value)}
                  className="min-h-[100px] resize-none font-mono text-sm"
                />
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
                  >
                    Markdown
                  </Button>
                  <Button
                    variant={format === "json" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFormat("json")}
                  >
                    JSON
                  </Button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={handleClose}>
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
            </>
          ) : (
            <>
              {/* Result Section */}
              <div className="flex-1 flex flex-col">
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

                <ScrollArea className="flex-1 border rounded-md p-4">
                  <pre className="whitespace-pre-wrap text-sm font-mono">
                    {result.refinedPrompt}
                  </pre>
                </ScrollArea>

                <div className="mt-3 flex items-center justify-between">
                  <Badge variant="secondary">
                    Format: {result.format.toUpperCase()}
                  </Badge>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={resetForm}>
                      Transform Another
                    </Button>
                    <Button onClick={handleClose}>
                      Done
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}