"use client";

import { useState, useEffect, useCallback } from "react";
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

interface AdvancedSearchProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  prompts: Array<{
    id: string;
    title: string;
    content: string;
    description?: string;
    tags: string[];
    targetModel: string;
    category: string;
    viewCount: number;
    createdAt: string;
  }>;
  onSearchSuggestionClick?: (suggestion: string) => void;
}

interface SearchSuggestion {
  text: string;
  type: "recent" | "popular" | "suggestion";
  prompt?: any;
}

export function AdvancedSearch({
  searchQuery,
  onSearchChange,
  prompts,
  onSearchSuggestionClick,
}: AdvancedSearchProps) {
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Mock search suggestions - in a real app, these would come from user behavior
  const popularSearches = [
    "blog post",
    "react component",
    "product description",
    "marketing copy",
    "code generation",
    "creative writing",
  ];

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      if (searchQuery.trim()) {
        onSearchChange(searchQuery);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, onSearchChange]);

  // Generate search suggestions based on current input
  const generateSuggestions = useCallback((): SearchSuggestion[] => {
    const suggestions: SearchSuggestion[] = [];
    const query = searchQuery.toLowerCase().trim();

    if (!query) {
      // Show recent and popular searches when query is empty
      recentSearches.slice(0, 3).forEach(search => {
        suggestions.push({ text: search, type: "recent" });
      });
      
      popularSearches.slice(0, 3).forEach(search => {
        if (!recentSearches.includes(search)) {
          suggestions.push({ text: search, type: "popular" });
        }
      });
      
      return suggestions;
    }

    // Find matching prompts
    const matchingPrompts = prompts.filter(prompt =>
      prompt.title.toLowerCase().includes(query) ||
      prompt.content.toLowerCase().includes(query) ||
      prompt.description?.toLowerCase().includes(query) ||
      prompt.tags.some(tag => tag.toLowerCase().includes(query)) ||
      prompt.targetModel.toLowerCase().includes(query) ||
      prompt.category.toLowerCase().includes(query)
    ).slice(0, 5);

    matchingPrompts.forEach(prompt => {
      suggestions.push({
        text: prompt.title,
        type: "suggestion",
        prompt,
      });
    });

    // Add matching tags
    const matchingTags = Array.from(
      new Set(prompts.flatMap(p => p.tags))
    ).filter(tag => tag.toLowerCase().includes(query)).slice(0, 3);

    matchingTags.forEach(tag => {
      suggestions.push({
        text: tag,
        type: "suggestion",
      });
    });

    return suggestions;
  }, [searchQuery, prompts, recentSearches]);

  const suggestions = generateSuggestions();

  const handleSearchSubmit = (query: string = searchQuery) => {
    if (query.trim()) {
      // Add to recent searches
      setRecentSearches(prev => {
        const updated = [query, ...prev.filter(s => s !== query)];
        return updated.slice(0, 10); // Keep only last 10 searches
      });
      
      onSearchChange(query);
      setShowSuggestions(false);
      setIsSearchFocused(false);
    }
  };

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    const query = suggestion.prompt ? suggestion.prompt.title : suggestion.text;
    onSearchChange(query);
    handleSearchSubmit(query);
    onSearchSuggestionClick?.(query);
  };

  const clearSearch = () => {
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
      ) : part
    );
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search prompts by title, content, tags, or model..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => {
            setIsSearchFocused(true);
            setShowSuggestions(true);
          }}
          onBlur={() => {
            // Delay hiding suggestions to allow clicking on them
            setTimeout(() => {
              setShowSuggestions(false);
            }, 200);
          }}
          onKeyDown={handleKeyPress}
          className="w-64 pl-10 pr-10"
        />
        {searchQuery && (
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

      {/* Search Suggestions Dropdown */}
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
                {/* Recent Searches */}
                {suggestions.filter(s => s.type === "recent").length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Recent Searches
                    </div>
                    {suggestions
                      .filter(s => s.type === "recent")
                      .map((suggestion, index) => (
                        <button
                          key={`recent-${index}`}
                          onClick={() => handleSuggestionClick(suggestion)}
                          className="w-full flex items-center gap-2 px-2 py-2 text-sm text-left rounded-md hover:bg-muted transition-colors"
                        >
                          <Search className="h-3 w-3 text-muted-foreground" />
                          {highlightMatch(suggestion.text, searchQuery)}
                        </button>
                      ))}
                  </div>
                )}

                {/* Popular Searches */}
                {suggestions.filter(s => s.type === "popular").length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground">
                      <TrendingUp className="h-3 w-3" />
                      Popular Searches
                    </div>
                    {suggestions
                      .filter(s => s.type === "popular")
                      .map((suggestion, index) => (
                        <button
                          key={`popular-${index}`}
                          onClick={() => handleSuggestionClick(suggestion)}
                          className="w-full flex items-center gap-2 px-2 py-2 text-sm text-left rounded-md hover:bg-muted transition-colors"
                        >
                          <TrendingUp className="h-3 w-3 text-muted-foreground" />
                          {highlightMatch(suggestion.text, searchQuery)}
                        </button>
                      ))}
                  </div>
                )}

                {/* Prompt Suggestions */}
                {suggestions.filter(s => s.type === "suggestion" && s.prompt).length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground">
                      <Search className="h-3 w-3" />
                      Matching Prompts
                    </div>
                    {suggestions
                      .filter(s => s.type === "suggestion" && s.prompt)
                      .map((suggestion, index) => (
                        <button
                          key={`prompt-${index}`}
                          onClick={() => handleSuggestionClick(suggestion)}
                          className="w-full text-left p-2 rounded-md hover:bg-muted transition-colors"
                        >
                          <div className="text-sm font-medium mb-1">
                            {highlightMatch(suggestion.prompt.title, searchQuery)}
                          </div>
                          <div className="text-xs text-muted-foreground line-clamp-2">
                            {suggestion.prompt.description || suggestion.prompt.content.substring(0, 100)}...
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {suggestion.prompt.targetModel}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {suggestion.prompt.category}
                            </Badge>
                          </div>
                        </button>
                      ))}
                  </div>
                )}

                {/* Tag Suggestions */}
                {suggestions.filter(s => s.type === "suggestion" && !s.prompt).length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground">
                      <Filter className="h-3 w-3" />
                      Matching Tags
                    </div>
                    <div className="flex flex-wrap gap-1 p-2">
                      {suggestions
                        .filter(s => s.type === "suggestion" && !s.prompt)
                        .map((suggestion, index) => (
                          <Badge
                            key={`tag-${index}`}
                            variant="outline"
                            className="text-xs cursor-pointer hover:bg-muted"
                            onClick={() => handleSuggestionClick(suggestion)}
                          >
                            #{highlightMatch(suggestion.text, searchQuery)}
                          </Badge>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      )}

      {/* Search Status */}
      {debouncedSearch && (
        <div className="absolute top-full left-0 right-0 mt-1">
          <div className="text-xs text-muted-foreground bg-background border rounded px-2 py-1">
            Searching for: "{debouncedSearch}"
          </div>
        </div>
      )}
    </div>
  );
}