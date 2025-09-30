"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Filter, 
  X, 
  Search, 
  Tag,
  Star,
  Clock,
  Zap,
  Folder,
  SlidersHorizontal
} from "lucide-react";

interface FilterPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: {
    search: string;
    categories: string[];
    tags: string[];
    targetModels: string[];
    rating: number | null;
    isFavorite: boolean | null;
    dateRange: string;
  };
  onFiltersChange: (filters: FilterPanelProps["filters"]) => void;
  availableCategories: Array<{ id: string; name: string; count: number }>;
  availableTags: Array<{ name: string; count: number }>;
  availableModels: Array<{ name: string; count: number }>;
}

const DATE_RANGES = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "year", label: "This Year" },
];

const RATING_OPTIONS = [
  { value: null, label: "Any Rating" },
  { value: 4, label: "4+ Stars" },
  { value: 3, label: "3+ Stars" },
  { value: 2, label: "2+ Stars" },
  { value: 1, label: "1+ Stars" },
];

export function FilterPanel({
  open,
  onOpenChange,
  filters,
  onFiltersChange,
  availableCategories,
  availableTags,
  availableModels,
}: FilterPanelProps) {
  const [localSearch, setLocalSearch] = useState(filters.search);
  const [localCategories, setLocalCategories] = useState(filters.categories);
  const [localTags, setLocalTags] = useState(filters.tags);
  const [localModels, setLocalModels] = useState(filters.targetModels);
  const [localRating, setLocalRating] = useState(filters.rating);
  const [localFavorite, setLocalFavorite] = useState(filters.isFavorite);
  const [localDateRange, setLocalDateRange] = useState(filters.dateRange);

  const updateFilter = (key: keyof typeof filters, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleCategory = (categoryId: string) => {
    const newCategories = localCategories.includes(categoryId)
      ? localCategories.filter(id => id !== categoryId)
      : [...localCategories, categoryId];
    setLocalCategories(newCategories);
    updateFilter("categories", newCategories);
  };

  const toggleTag = (tagName: string) => {
    const newTags = localTags.includes(tagName)
      ? localTags.filter(tag => tag !== tagName)
      : [...localTags, tagName];
    setLocalTags(newTags);
    updateFilter("tags", newTags);
  };

  const toggleModel = (modelName: string) => {
    const newModels = localModels.includes(modelName)
      ? localModels.filter(model => model !== modelName)
      : [...localModels, modelName];
    setLocalModels(newModels);
    updateFilter("targetModels", newModels);
  };

  const clearAllFilters = () => {
    setLocalSearch("");
    setLocalCategories([]);
    setLocalTags([]);
    setLocalModels([]);
    setLocalRating(null);
    setLocalFavorite(null);
    setLocalDateRange("all");
    onFiltersChange({
      search: "",
      categories: [],
      tags: [],
      targetModels: [],
      rating: null,
      isFavorite: null,
      dateRange: "all",
    });
  };

  const hasActiveFilters = 
    localSearch ||
    localCategories.length > 0 ||
    localTags.length > 0 ||
    localModels.length > 0 ||
    localRating !== null ||
    localFavorite !== null ||
    localDateRange !== "all";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <SlidersHorizontal className="h-4 w-4 mr-2" />
          Filters
          {hasActiveFilters && (
            <Badge variant="secondary" className="ml-2 text-xs">
              {[
                localCategories.length,
                localTags.length,
                localModels.length,
                localRating !== null ? 1 : 0,
                localFavorite !== null ? 1 : 0,
                localDateRange !== "all" ? 1 : 0,
              ].reduce((a, b) => a + b, 0)}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filter Prompts
          </DialogTitle>
          <DialogDescription>
            Filter prompts by various criteria to find exactly what you need.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Search */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Search className="h-4 w-4" />
              Search
            </h4>
            <Input
              placeholder="Search in title, content, or description..."
              value={localSearch}
              onChange={(e) => {
                setLocalSearch(e.target.value);
                updateFilter("search", e.target.value);
              }}
            />
          </div>

          <Separator />

          {/* Categories */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Folder className="h-4 w-4" />
              Categories
            </h4>
            <ScrollArea className="max-h-32">
              <div className="grid grid-cols-2 gap-2">
                {availableCategories.map((category) => (
                  <label
                    key={category.id}
                    className="flex items-center space-x-2 p-2 rounded hover:bg-muted cursor-pointer"
                  >
                    <Checkbox
                      checked={localCategories.includes(category.id)}
                      onCheckedChange={() => toggleCategory(category.id)}
                    />
                    <span className="text-sm flex-1">{category.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {category.count}
                    </Badge>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </div>

          <Separator />

          {/* Tags */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Tags
            </h4>
            <ScrollArea className="max-h-32">
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => (
                  <Badge
                    key={tag.name}
                    variant={localTags.includes(tag.name) ? "default" : "outline"}
                    className="cursor-pointer text-xs"
                    onClick={() => toggleTag(tag.name)}
                  >
                    {tag.name}
                    <span className="ml-1 opacity-70">({tag.count})</span>
                  </Badge>
                ))}
              </div>
            </ScrollArea>
          </div>

          <Separator />

          {/* Target Models */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Target Models
            </h4>
            <ScrollArea className="max-h-32">
              <div className="grid grid-cols-2 gap-2">
                {availableModels.map((model) => (
                  <label
                    key={model.name}
                    className="flex items-center space-x-2 p-2 rounded hover:bg-muted cursor-pointer"
                  >
                    <Checkbox
                      checked={localModels.includes(model.name)}
                      onCheckedChange={() => toggleModel(model.name)}
                    />
                    <span className="text-sm flex-1">{model.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {model.count}
                    </Badge>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </div>

          <Separator />

          {/* Rating and Favorites */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Star className="h-4 w-4" />
                Minimum Rating
              </h4>
              <Select
                value={localRating?.toString() || "all"}
                onValueChange={(value) => {
                  const rating = value === "all" ? null : parseInt(value);
                  setLocalRating(rating);
                  updateFilter("rating", rating);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any rating" />
                </SelectTrigger>
                <SelectContent>
                  {RATING_OPTIONS.map((option) => (
                    <SelectItem key={option.value?.toString() || "all"} value={option.value?.toString() || "all"}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Date Range
              </h4>
              <Select
                value={localDateRange}
                onValueChange={(value) => {
                  setLocalDateRange(value);
                  updateFilter("dateRange", value);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_RANGES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Favorites Toggle */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Quick Filters</h4>
            <div className="flex gap-2">
              <Button
                variant={localFavorite === true ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  const newValue = localFavorite === true ? null : true;
                  setLocalFavorite(newValue);
                  updateFilter("isFavorite", newValue);
                }}
              >
                <Star className="h-4 w-4 mr-2" />
                Favorites Only
              </Button>
            </div>
          </div>

          <Separator />

          {/* Active Filters Display */}
          {hasActiveFilters && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Active Filters</h4>
              <div className="flex flex-wrap gap-2">
                {localSearch && (
                  <Badge variant="secondary" className="text-xs">
                    Search: {localSearch}
                    <X
                      className="h-3 w-3 ml-1 cursor-pointer"
                      onClick={() => {
                        setLocalSearch("");
                        updateFilter("search", "");
                      }}
                    />
                  </Badge>
                )}
                {localCategories.map((cat) => {
                  const category = availableCategories.find(c => c.id === cat);
                  return (
                    <Badge key={cat} variant="secondary" className="text-xs">
                      Category: {category?.name}
                      <X
                        className="h-3 w-3 ml-1 cursor-pointer"
                        onClick={() => toggleCategory(cat)}
                      />
                    </Badge>
                  );
                })}
                {localTags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    Tag: {tag}
                    <X
                      className="h-3 w-3 ml-1 cursor-pointer"
                      onClick={() => toggleTag(tag)}
                    />
                  </Badge>
                ))}
                {localModels.map((model) => (
                  <Badge key={model} variant="secondary" className="text-xs">
                    Model: {model}
                    <X
                      className="h-3 w-3 ml-1 cursor-pointer"
                      onClick={() => toggleModel(model)}
                    />
                  </Badge>
                ))}
                {localRating !== null && (
                  <Badge variant="secondary" className="text-xs">
                    Rating: {localRating}+ Stars
                    <X
                      className="h-3 w-3 ml-1 cursor-pointer"
                      onClick={() => {
                        setLocalRating(null);
                        updateFilter("rating", null);
                      }}
                    />
                  </Badge>
                )}
                {localFavorite === true && (
                  <Badge variant="secondary" className="text-xs">
                    Favorites Only
                    <X
                      className="h-3 w-3 ml-1 cursor-pointer"
                      onClick={() => {
                        setLocalFavorite(null);
                        updateFilter("isFavorite", null);
                      }}
                    />
                  </Badge>
                )}
                {localDateRange !== "all" && (
                  <Badge variant="secondary" className="text-xs">
                    Date: {DATE_RANGES.find(d => d.value === localDateRange)?.label}
                    <X
                      className="h-3 w-3 ml-1 cursor-pointer"
                      onClick={() => {
                        setLocalDateRange("all");
                        updateFilter("dateRange", "all");
                      }}
                    />
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={clearAllFilters}>
              Clear All Filters
            </Button>
            <Button onClick={() => onOpenChange(false)}>
              Apply Filters
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}