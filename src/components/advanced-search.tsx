"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { Search, X, Clock, TrendingUp, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

type PromptSummary = {
  id: string;
  title: string;
  content: string;
  description?: string | null;
  tags: Array<{ tag?: { name: string } } | { name: string }>;
  targetModel: string;
  category?: { id: string; name: string } | string | null;
  viewCount?: number;
  createdAt?: string;
};

interface AdvancedSearchProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  prompts: PromptSummary[];
  onSearchSuggestionClick?: (suggestion: string) => void;
}

const POPULAR_SEARCHES = [
  "blog post",
  "react component",
  "product description",
  "marketing copy",
  "code generation",
  "creative writing",
] as const;

interface SearchSuggestion {
  text: string;
  type: "recent" | "popular" | "suggestion";
  prompt?: PromptSummary & { tagNames: string[]; categoryName: string };
}

export function AdvancedSearch({
  searchQuery,
  onSearchChange,
  prompts,
  onSearchSuggestionClick,
}: AdvancedSearchProps) {
  const [inputValue, setInputValue] = useState(searchQuery);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const debouncedSearch = useDebounce(inputValue, 300);

  const normalizedPrompts = useMemo(() =>
    prompts.map((prompt) => {
      const tagNames = (prompt.tags || [])
        .map((tagEntry) => {
          if ("tag" in tagEntry && tagEntry.tag) {
            return tagEntry.tag.name;
          }
          if ("name" in tagEntry) {
            return tagEntry.name;
          }
          return "";
        })
        .filter(Boolean);

      const categoryName = typeof prompt.category === "string"
        ? prompt.category
        : prompt.category?.name ?? "";

      return {
        ...prompt,
        tagNames,
        categoryName,
      };
    })
  , [prompts]);

  useEffect(() => {
    setInputValue(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    onSearchChange(debouncedSearch.trim());
  }, [debouncedSearch, onSearchChange]);

  const generateSuggestions = useCallback((): SearchSuggestion[] => {
    const suggestions: SearchSuggestion[] = [];
    const query = inputValue.toLowerCase().trim();

    if (!query) {
      recentSearches.slice(0, 3).forEach((search) => {
        suggestions.push({ text: search, type: "recent" });
      });

      POPULAR_SEARCHES.slice(0, 3).forEach((search) => {
        if (!recentSearches.includes(search)) {
          suggestions.push({ text: search, type: "popular" });
        }
      });

      return suggestions;
    }

    const matchingPrompts = normalizedPrompts
      .filter((prompt) =>
        prompt.title.toLowerCase().includes(query) ||
        prompt.content.toLowerCase().includes(query) ||
        prompt.description?.toLowerCase().includes(query) ||
        prompt.tagNames.some((tag) => tag.toLowerCase().includes(query)) ||
        prompt.targetModel.toLowerCase().includes(query) ||
        prompt.categoryName.toLowerCase().includes(query)
      )
      .slice(0, 5);

    matchingPrompts.forEach((prompt) => {
      suggestions.push({
        text: prompt.title,
        type: "suggestion",
        prompt,
      });
    });

    const matchingTags = Array.from(
      new Set(normalizedPrompts.flatMap((p) => p.tagNames))
    )
      .filter((tag) => tag.toLowerCase().includes(query))
      .slice(0, 3);

    matchingTags.forEach((tag) => {
      suggestions.push({
        text: tag,
        type: "suggestion",
      });
    });

    return suggestions;
  }, [inputValue, normalizedPrompts, recentSearches]);

  const suggestions = generateSuggestions();

  const handleSearchSubmit = (query: string = inputValue) => {
    const normalizedQuery = query.trim();
    if (normalizedQuery) {
      setRecentSearches((prev) => {
        const updated = [normalizedQuery, ...prev.filter((s) => s !== normalizedQuery)];
        return updated.slice(0, 10);
      });

      onSearchChange(normalizedQuery);
      setShowSuggestions(false);
      setIsSearchFocused(false);
    }
  };

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    const query = suggestion.prompt ? suggestion.prompt.title : suggestion.text;
    setInputValue(query);
    handleSearchSubmit(query);
    onSearchSuggestionClick?.(query);
  };

  const clearSearch = () => {
    setInputValue("");
    onSearchChange("");
    setIsSearchFocused(false);
    setShowSuggestions(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearchSubmit();
    } else if (e.key === "Escape") {
      setIsSearchFocused(false);
      setShowSuggestions(false);
    }
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;

    const regex = new RegExp(`(${query})`, "gi");
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <span key={index} className="bg-yellow-200 dark:bg-yellow-800 font-semibold">
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search prompts by title, content, tags, or model..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onFocus={() => {
            setIsSearchFocused(true);
            setShowSuggestions(true);
          }}
          onBlur={() => {
            setTimeout(() => {
              setShowSuggestions(false);
            }, 200);
          }}
          onKeyDown={handleKeyPress}
          className="w-64 pl-10 pr-10"
        />
        {inputValue && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 p-0"
            onClick={clearSearch}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {isSearchFocused && showSuggestions && suggestions.length > 0 && (
        <Popover open={true}>
          <PopoverTrigger asChild>
            <div className="absolute top-full left-0 right-0 z-50 mt-1" />
          </PopoverTrigger>
          <PopoverContent
            className="w-80 p-0"
            align="start"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <ScrollArea className="max-h-80">
              <div className="p-2">
                {suggestions.filter((s) => s.type === "recent").length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Recent Searches
                    </div>
                    {suggestions
                      .filter((s) => s.type === "recent")
                      .map((suggestion, index) => (
                        <button
                          key={`recent-${index}`}
                          onClick={() => handleSuggestionClick(suggestion)}
                          className="w-full flex items-center gap-2 px-2 py-2 text-sm text-left rounded-md hover:bg-muted transition-colors"
                        >
                          <Search className="h-3 w-3 text-muted-foreground" />
                          <span>{suggestion.text}</span>
                        </button>
                      ))}
                  </div>
                )}

                <Separator className="my-2" />

                {suggestions.filter((s) => s.type === "popular").length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground">
                      <TrendingUp className="h-3 w-3" />
                      Popular Searches
                    </div>
                    <div className="flex flex-wrap gap-2 px-2 py-2">
                      {suggestions
                        .filter((s) => s.type === "popular")
                        .map((suggestion, index) => (
                          <Badge
                            key={`popular-${index}`}
                            variant="secondary"
                            className="cursor-pointer"
                            onClick={() => handleSuggestionClick(suggestion)}
                          >
                            {suggestion.text}
                          </Badge>
                        ))}
                    </div>
                  </div>
                )}

                <Separator className="my-2" />

                {suggestions.filter((s) => s.type === "suggestion").length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground">
                      <Filter className="h-3 w-3" />
                      Suggestions
                    </div>
                    <div className="space-y-1">
                      {suggestions
                        .filter((s) => s.type === "suggestion")
                        .map((suggestion, index) => (
                          <button
                            key={`suggestion-${index}`}
                            onClick={() => handleSuggestionClick(suggestion)}
                            className="w-full text-left px-2 py-2 rounded-md hover:bg-muted transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">
                                {highlightMatch(suggestion.text, inputValue)}
                              </span>
                              {suggestion.prompt && suggestion.prompt.categoryName && (
                                <Badge variant="outline" className="ml-2 text-xs">
                                  {suggestion.prompt.categoryName}
                                </Badge>
                              )}
                            </div>
                            {suggestion.prompt && (
                              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                                {highlightMatch(
                                  suggestion.prompt.content,
                                  inputValue
                                )}
                              </p>
                            )}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
