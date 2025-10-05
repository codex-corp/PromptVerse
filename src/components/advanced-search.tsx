// components/advanced-search.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, FileText } from "lucide-react";

interface Prompt {
    id: string;
    title: string;
    content: string;
    description?: string;
    targetModel: string;
    category?: { id: string; name: string; color?: string };
    tags?: Array<{ tag: { id: string; name: string; color?: string } }>;
    averageRating: number;
    totalRatings: number;
    userRating?: number;
    userComment?: string;
    isFavorite: boolean;
    viewCount: number;
    createdAt: string;
    author: { id: string; name: string; email: string };
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    notes?: string;
    versions?: Array<{
        id: string;
        title: string;
        content: string;
        description?: string;
        targetModel: string;
        temperature?: number;
        maxTokens?: number;
        topP?: number;
        frequencyPenalty?: number;
        presencePenalty?: number;
        notes?: string;
        versionNote?: string;
        createdAt: string;
        author: string;
    }>;
}

interface AdvancedSearchProps {
    searchQuery: string;
    onSearchChange: (query: string) => void;
    prompts?: Prompt[];
}

export function AdvancedSearch({ searchQuery, onSearchChange, prompts = [] }: AdvancedSearchProps) {
    const [open, setOpen] = useState(false);
    const [inputValue, setInputValue] = useState(searchQuery);
    const [suggestions, setSuggestions] = useState<Prompt[]>(prompts);
    const [isFetching, setIsFetching] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<number | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    // Update input value when searchQuery prop changes
    useEffect(() => {
        setInputValue(searchQuery);
    }, [searchQuery]);

    // Handle Enter key press
    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === "Enter") {
            onSearchChange(inputValue);
            setOpen(false);
        }
    };

    useEffect(() => {
        setSuggestions(prompts);
    }, [prompts]);

    useEffect(() => {
        if (!open) {
            return;
        }

        if (debounceRef.current) {
            window.clearTimeout(debounceRef.current);
        }

        if (abortRef.current) {
            abortRef.current.abort();
        }

        const controller = new AbortController();
        abortRef.current = controller;

        debounceRef.current = window.setTimeout(async () => {
            const query = inputValue.trim();

            try {
                setIsFetching(true);
                const params = new URLSearchParams();
                if (query.length > 0) {
                    params.set("search", query);
                }
                params.set("limit", "25");

                const response = await fetch(`/api/prompts?${params.toString()}`, {
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error("Failed to fetch search results");
                }

                const data = await response.json();
                setSuggestions(data.prompts ?? []);
            } catch (error) {
                if (controller.signal.aborted) {
                    return;
                }
                console.error("Search fetch failed", error);
                setSuggestions(prompts);
            } finally {
                if (!controller.signal.aborted) {
                    setIsFetching(false);
                }
            }
        }, 200);

        return () => {
            if (debounceRef.current) {
                window.clearTimeout(debounceRef.current);
            }
            controller.abort();
        };
    }, [inputValue, open, prompts]);

    useEffect(() => {
        return () => {
            if (debounceRef.current) {
                window.clearTimeout(debounceRef.current);
            }
            if (abortRef.current) {
                abortRef.current.abort();
            }
        };
    }, []);

    return (
        <div className="relative">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <div className="relative w-full max-w-sm">
                        <Input
                            ref={inputRef}
                            placeholder="Search prompts..."
                            value={inputValue}
                            onChange={(e) => {
                                setInputValue(e.target.value);
                            }}
                            onKeyDown={(event) => {
                                if (event.key === "Escape") {
                                    setOpen(false);
                                    inputRef.current?.blur();
                                    return;
                                }
                                handleKeyDown(event);
                            }}
                            onFocus={() => setOpen(true)}
                            onClick={() => setOpen(true)}
                            className="pl-10 pr-10"
                        />
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        {inputValue && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                                onClick={() => {
                                    setInputValue("");
                                    onSearchChange("");
                                    setOpen(false);
                                }}
                            >
                                ×
                            </Button>
                        )}
                    </div>
                </PopoverTrigger>
                <PopoverContent align="start" className="p-0 w-[360px]">
                    <Command shouldFilter={false} className="max-h-72 overflow-y-auto">
                        <CommandList>
                            <CommandEmpty>
                                {isFetching ? "Searching prompts…" : "No prompts found."}
                            </CommandEmpty>
                            <CommandGroup>
                                {suggestions.slice(0, 10).map((prompt) => (
                                    <CommandItem
                                        key={prompt.id}
                                        onSelect={() => {
                                            setInputValue(prompt.title);
                                            onSearchChange(prompt.title);
                                            setOpen(false);
                                        }}
                                    >
                                        <div className="flex items-center gap-2">
                                            <FileText className="h-4 w-4" />
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium">{prompt.title}</span>
                                                <span className="text-xs text-muted-foreground truncate max-w-[240px]">
                                                    {prompt.description || `${prompt.content.slice(0, 80)}…`}
                                                </span>
                                            </div>
                                        </div>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );
}
