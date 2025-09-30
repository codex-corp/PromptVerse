// components/advanced-search.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, FileText, User, Tag, Zap } from "lucide-react";

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
    prompts: Prompt[];
}

export function AdvancedSearch({ searchQuery, onSearchChange, prompts }: AdvancedSearchProps) {
    const [open, setOpen] = useState(false);
    const [inputValue, setInputValue] = useState(searchQuery);
    const inputRef = useRef<HTMLInputElement>(null);

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

    // Filter prompts based on input
    const filteredPrompts = prompts.filter(prompt =>
        prompt.title.toLowerCase().includes(inputValue.toLowerCase()) ||
        prompt.content.toLowerCase().includes(inputValue.toLowerCase()) ||
        prompt.description?.toLowerCase().includes(inputValue.toLowerCase()) ||
        prompt.tags?.some(tag => tag.tag.name.toLowerCase().includes(inputValue.toLowerCase()))
    );

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
                                onSearchChange(e.target.value);
                            }}
                            onKeyDown={handleKeyDown}
                            onFocus={() => setOpen(true)}
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
                <PopoverContent className="p-0 w-[300px]">
                    <Command>
                        <CommandInput placeholder="Search prompts..." />
                        <CommandEmpty>No prompts found.</CommandEmpty>
                        <CommandGroup>
                            {filteredPrompts.slice(0, 5).map((prompt) => (
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
                                            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {prompt.description || prompt.content.substring(0, 50) + "..."}
                      </span>
                                        </div>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );
}