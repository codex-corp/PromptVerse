"use client";

import { useState, useEffect, useCallback } from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { PromptForm } from "@/components/prompt-form";
import { FilterPanel } from "@/components/filter-panel";
import { RatingComponent } from "@/components/rating-component";
import { AdvancedSearch } from "@/components/advanced-search";
import { VersionManager } from "@/components/version-manager";
import { PromptTransformer } from "@/components/prompt-transformer";
import { PWAInstallButton } from "@/components/pwa-install-button";
import { 
  Search, 
  Plus, 
  Star, 
  Heart, 
  Copy, 
  Filter,
  Folder,
  Tag,
  Settings,
  BookOpen,
  Zap
} from "lucide-react";

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

interface Category {
  id: string;
  name: string;
  count: number;
  icon?: any;
}

export default function PromptVerse() {
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [isTransformerOpen, setIsTransformerOpen] = useState(false);
  const [filters, setFilters] = useState({
    search: "",
    categories: [] as string[],
    tags: [] as string[],
    targetModels: [] as string[],
    rating: null as number | null,
    isFavorite: null as boolean | null,
    dateRange: "all",
  });
  
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [defaultUser, setDefaultUser] = useState<{ id: string; name: string; email: string } | null>(null);

  const handleSearchChange = useCallback((query: string) => {
    setFilters((prev) => ({ ...prev, search: query }));
  }, []);

  const fetchDefaultUser = useCallback(async () => {
    try {
      const response = await fetch("/api/users?limit=1");
      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }

      const data = await response.json();
      const firstUser = data.users?.[0] ?? null;
      setDefaultUser(firstUser);
      return firstUser as { id: string; name: string; email: string } | null;
    } catch (err) {
      console.error("Error fetching default user:", err);
      setDefaultUser(null);
      return null;
    }
  }, []);

  // Fetch prompts from API
  const fetchPrompts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (filters.search) params.append("search", filters.search);
      if (filters.categories.length > 0) params.append("categories", filters.categories.join(","));
      if (filters.tags.length > 0) params.append("tags", filters.tags.join(","));
      if (filters.targetModels.length > 0) params.append("models", filters.targetModels.join(","));
      if (filters.rating !== null) params.append("rating", filters.rating.toString());
      if (filters.isFavorite !== null) params.append("favorite", filters.isFavorite.toString());
      if (filters.dateRange !== "all") params.append("dateRange", filters.dateRange);
      
      const response = await fetch(`/api/prompts?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch prompts");
      }
      
      const data = await response.json();
      const normalized = (data.prompts || []).map((prompt: any) => ({
        ...prompt,
        tags: prompt.tags ?? [],
      }));
      setPrompts(normalized);
    } catch (err) {
      console.error("Error fetching prompts:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  // Fetch categories from API
  const fetchCategories = async () => {
    try {
      const response = await fetch("/api/categories?includeCounts=true");
      if (!response.ok) {
        throw new Error("Failed to fetch categories");
      }
      
      const data = await response.json();
      const formattedCategories = [
        { id: "all", name: "All Prompts", count: data.total || 0, icon: BookOpen },
        ...data.categories.map((cat: any) => ({
          id: cat.id,
          name: cat.name,
          count: cat.count || 0,
          icon: Folder
        }))
      ];
      setCategories(formattedCategories);
    } catch (err) {
      console.error("Error fetching categories:", err);
      // Fallback to basic categories
      setCategories([
        { id: "all", name: "All Prompts", count: 0, icon: BookOpen },
        { id: "marketing", name: "Marketing", count: 0, icon: Zap },
        { id: "code", name: "Code Generation", count: 0, icon: Copy },
        { id: "creative", name: "Creative Writing", count: 0, icon: Star },
        { id: "analysis", name: "Analysis", count: 0, icon: Filter },
        { id: "business", name: "Business", count: 0, icon: Folder },
      ]);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchPrompts();
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchDefaultUser();
  }, [fetchDefaultUser]);

  // Fetch prompts when filters change
  useEffect(() => {
    fetchPrompts();
  }, [filters]);

  // Filter prompts based on selected category (from left panel)
  const filteredPrompts = prompts.filter(prompt => {
    if (selectedCategory === "all") return true;
    return prompt.category?.id === selectedCategory;
  });

  // Generate available tags and models for filter panel
  const allTags = prompts.reduce((acc, prompt) => {
    (prompt.tags ?? []).forEach((tagObj) => {
      const tag = tagObj.tag.name;
      const existing = acc.find(t => t.name === tag);
      if (existing) {
        existing.count++;
      } else {
        acc.push({ name: tag, count: 1 });
      }
    });
    return acc;
  }, [] as Array<{ name: string; count: number }>);

  const allModels = prompts.reduce((acc, prompt) => {
    if (!prompt.targetModel) {
      return acc;
    }
    const existing = acc.find(m => m.name === prompt.targetModel);
    if (existing) {
      existing.count++;
    } else {
      acc.push({ name: prompt.targetModel, count: 1 });
    }
    return acc;
  }, [] as Array<{ name: string; count: number }>);

  const handleCreatePrompt = async (data: any) => {
    try {
      const author = defaultUser ?? (await fetchDefaultUser());
      if (!author) {
        throw new Error("No default author available");
      }

      const payload = {
        ...data,
        categoryId: data.categoryId || undefined,
        tags: (data.tags || []).filter((tag: string) => tag.trim().length > 0),
        authorId: author.id,
      };

      const response = await fetch("/api/prompts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to create prompt");
      }

      await fetchPrompts();
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error("Error creating prompt:", error);
    }
  };

  const handleEditPrompt = async (data: any) => {
    if (!selectedPrompt) return;
    
    try {
      const payload = {
        ...data,
        categoryId: data.categoryId || undefined,
        tags: (data.tags || []).filter((tag: string) => tag.trim().length > 0),
      };

      const response = await fetch(`/api/prompts/${selectedPrompt.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to update prompt");
      }

      await fetchPrompts(); // Refresh the prompts list
      setIsEditDialogOpen(false);
    } catch (error) {
      console.error("Error updating prompt:", error);
      // You could show an error message to the user here
    }
  };

  const handleClonePrompt = () => {
    if (selectedPrompt) {
      console.log("Opening clone dialog for prompt:", selectedPrompt.id);
      // The actual cloning will be handled by the VersionManager component
    }
  };

  const handleVersionClone = async (originalPromptId: string, cloneData: {
    title: string;
    versionNote: string;
    updates: any;
  }) => {
    try {
      const author = defaultUser ?? (await fetchDefaultUser());
      if (!author) {
        throw new Error("No default author available");
      }

      const response = await fetch("/api/prompts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...cloneData.updates,
          title: cloneData.title,
          authorId: author.id,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to clone prompt");
      }

      await fetchPrompts(); // Refresh the prompts list
      
      // Select the new prompt (you might need to get the ID from the response)
      console.log("Created cloned prompt successfully");
    } catch (error) {
      console.error("Error cloning prompt:", error);
    }
  };

  const handleToggleFavorite = async (promptId: string) => {
    try {
      const prompt = prompts.find(p => p.id === promptId);
      if (!prompt) return;

      const response = await fetch(`/api/prompts/${promptId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          isFavorite: !prompt.isFavorite,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to toggle favorite");
      }

      await fetchPrompts(); // Refresh the prompts list
    } catch (error) {
      console.error("Error toggling favorite:", error);
    }
  };

  const handleRatingChange = async (promptId: string, rating: number, comment?: string) => {
    try {
      const author = defaultUser ?? (await fetchDefaultUser());
      if (!author) {
        throw new Error("No default user available for rating");
      }

      const response = await fetch("/api/ratings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          value: rating,
          comment,
          userId: author.id,
          promptId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit rating");
      }

      await fetchPrompts(); // Refresh the prompts list
    } catch (error) {
      console.error("Error submitting rating:", error);
    }
  };

  return (
    <div className="h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="flex h-16 items-center px-6">
          <div className="flex items-center space-x-4">
            <BookOpen className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">PromptVerse</h1>
          </div>
          <div className="ml-auto flex items-center space-x-4">
            <AdvancedSearch
              searchQuery={filters.search}
              onSearchChange={handleSearchChange}
              prompts={filteredPrompts}
            />
            <Button size="sm" onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Prompt
            </Button>
            <FilterPanel
              open={isFilterPanelOpen}
              onOpenChange={setIsFilterPanelOpen}
              filters={filters}
              onFiltersChange={setFilters}
              availableCategories={categories.filter(c => c.id !== "all")}
              availableTags={allTags}
              availableModels={allModels}
            />
            <PWAInstallButton className="items-start" />
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Mobile First - Show Categories as Dropdown */}
        <div className="md:hidden border-b bg-card p-4">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full p-2 border rounded-md bg-background"
          >
            {categories.map((category) => {
              const Icon = category.icon;
              return (
                <option key={category.id} value={category.id}>
                  {category.name} ({category.count})
                </option>
              );
            })}
          </select>
        </div>

        <ResizablePanelGroup direction="horizontal" className="flex-1 hidden md:flex">
          {/* Left Panel - Categories (Hidden on Mobile) */}
          <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
            <Card className="h-full rounded-none border-0">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Categories</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-8rem)]">
                  <div className="space-y-1 p-3">
                    {categories.map((category) => {
                      const Icon = category.icon;
                      return (
                        <button
                          key={category.id}
                          onClick={() => setSelectedCategory(category.id)}
                          className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors ${
                            selectedCategory === category.id
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-muted"
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <Icon className="h-4 w-4" />
                            <span className="text-sm font-medium">{category.name}</span>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {category.count}
                          </Badge>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Middle Panel - Prompt List */}
          <ResizablePanel defaultSize={35} minSize={25} maxSize={50}>
            <Card className="h-full rounded-none border-0">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">
                    Prompts ({filteredPrompts.length})
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-8rem)]">
                  <div className="space-y-2 p-3">
                    {loading ? (
                      <div className="flex items-center justify-center h-32">
                        <div className="text-muted-foreground">Loading prompts...</div>
                      </div>
                    ) : error ? (
                      <div className="flex items-center justify-center h-32">
                        <div className="text-red-500">Error: {error}</div>
                      </div>
                    ) : filteredPrompts.length === 0 ? (
                      <div className="flex items-center justify-center h-32">
                        <div className="text-muted-foreground">No prompts found</div>
                      </div>
                    ) : (
                      filteredPrompts.map((prompt) => (
                        <Card
                          key={prompt.id}
                          className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                            selectedPrompt?.id === prompt.id ? "ring-2 ring-primary" : ""
                          }`}
                          onClick={() => setSelectedPrompt(prompt)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between space-x-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2 mb-2">
                                  <h3 className="font-medium text-sm truncate">
                                    {prompt.title}
                                  </h3>
                                </div>
                                <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                                  {prompt.description || prompt.content.substring(0, 100)}...
                                </p>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    {prompt.targetModel}
                                  </Badge>
                                  {prompt.category && (
                                    <Badge variant="secondary" className="text-xs">
                                      {prompt.category.name}
                                    </Badge>
                                  )}
                                  <RatingComponent
                                    promptId={prompt.id}
                                    currentRating={prompt.averageRating}
                                    totalRatings={prompt.totalRatings}
                                    isFavorite={prompt.isFavorite}
                                    onRatingChange={handleRatingChange}
                                    onFavoriteToggle={handleToggleFavorite}
                                    userRating={prompt.userRating}
                                  />
                                </div>
                              </div>
                            </div>
                            <Separator className="my-2" />
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>by {prompt.author.name}</span>
                              <span>{prompt.viewCount} views</span>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right Panel - Prompt Details (Hidden on Mobile when not selected) */}
          <ResizablePanel defaultSize={45} minSize={25} maxSize={70} className="hidden md:flex">
            <Card className="h-full rounded-none border-0">
              {selectedPrompt ? (
                <>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <CardTitle className="text-lg">{selectedPrompt.title}</CardTitle>
                      </div>
                      <div className="flex items-center space-x-2">
                        <VersionManager
                          prompt={selectedPrompt}
                          onClone={handleVersionClone}
                        />
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setIsEditDialogOpen(true)}
                        >
                          Edit
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[calc(100vh-10rem)]">
                      <div className="space-y-6 p-6">
                        {/* Description */}
                        <div>
                          <h3 className="text-sm font-medium mb-2">Description</h3>
                          <p className="text-sm text-muted-foreground">
                            {selectedPrompt.description}
                          </p>
                        </div>

                        {/* Prompt Content */}
                        <div>
                          <h3 className="text-sm font-medium mb-2">Prompt Content</h3>
                          <div className="bg-muted p-4 rounded-lg">
                            <pre className="text-sm whitespace-pre-wrap">
                              {selectedPrompt.content}
                            </pre>
                          </div>
                        </div>

                        {/* Tags */}
                        <div>
                          <h3 className="text-sm font-medium mb-2">Tags</h3>
                          <div className="flex flex-wrap gap-2">
                            {(selectedPrompt.tags ?? []).map((tagObj: { tag: { id: string; name: string; color?: string } }) => (
                              <Badge key={tagObj.tag.id} variant="secondary" className="text-xs">
                                <Tag className="h-3 w-3 mr-1" />
                                {tagObj.tag.name}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        {/* Rating and Favorites */}
                        <div>
                          <h3 className="text-sm font-medium mb-2">Rating & Favorites</h3>
                          <RatingComponent
                            promptId={selectedPrompt.id}
                            currentRating={selectedPrompt.averageRating}
                            totalRatings={selectedPrompt.totalRatings}
                            isFavorite={selectedPrompt.isFavorite}
                            onRatingChange={handleRatingChange}
                            onFavoriteToggle={handleToggleFavorite}
                            userRating={selectedPrompt.userRating}
                            userComment={selectedPrompt.userComment}
                            showDetails={true}
                          />
                        </div>

                        {/* Parameters */}
                        <div>
                          <h3 className="text-sm font-medium mb-2">Parameters</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <span className="text-xs text-muted-foreground">Target Model</span>
                              <p className="text-sm font-medium">{selectedPrompt.targetModel}</p>
                            </div>
                            <div>
                              <span className="text-xs text-muted-foreground">Temperature</span>
                              <p className="text-sm font-medium">{selectedPrompt.temperature}</p>
                            </div>
                            <div>
                              <span className="text-xs text-muted-foreground">Max Tokens</span>
                              <p className="text-sm font-medium">{selectedPrompt.maxTokens}</p>
                            </div>
                            <div>
                              <span className="text-xs text-muted-foreground">Top P</span>
                              <p className="text-sm font-medium">{selectedPrompt.topP}</p>
                            </div>
                            <div>
                              <span className="text-xs text-muted-foreground">Frequency Penalty</span>
                              <p className="text-sm font-medium">{selectedPrompt.frequencyPenalty}</p>
                            </div>
                            <div>
                              <span className="text-xs text-muted-foreground">Presence Penalty</span>
                              <p className="text-sm font-medium">{selectedPrompt.presencePenalty}</p>
                            </div>
                          </div>
                        </div>

                        {/* Notes */}
                        {selectedPrompt.notes && (
                          <div>
                            <h3 className="text-sm font-medium mb-2">Notes</h3>
                            <p className="text-sm text-muted-foreground">
                              {selectedPrompt.notes}
                            </p>
                          </div>
                        )}

                        {/* Metadata */}
                        <div>
                          <h3 className="text-sm font-medium mb-2">Metadata</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Author:</span>
                              <span className="ml-2 font-medium">{selectedPrompt.author.name}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Views:</span>
                              <span className="ml-2 font-medium">{selectedPrompt.viewCount}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Created:</span>
                              <span className="ml-2 font-medium">{selectedPrompt.createdAt}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </ScrollArea>
                  </CardContent>
                </>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center space-y-3">
                    <BookOpen className="h-12 w-12 text-muted-foreground mx-auto" />
                    <h3 className="text-lg font-medium">Select a Prompt</h3>
                    <p className="text-sm text-muted-foreground">
                      Choose a prompt from the list to view its details
                    </p>
                  </div>
                </div>
              )}
            </Card>
          </ResizablePanel>
        </ResizablePanelGroup>

        {/* Mobile Prompt Details Modal/Drawer */}
        {selectedPrompt && (
          <div className="lg:hidden fixed inset-0 z-50 bg-background">
            <div className="h-full flex flex-col">
              {/* Mobile Header */}
              <div className="border-b p-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">{selectedPrompt.title}</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedPrompt(null)}
                >
                  ×
                </Button>
              </div>

              {/* Mobile Content */}
              <ScrollArea className="flex-1">
                <div className="space-y-6 p-4">
                  {/* Description */}
                  <div>
                    <h3 className="text-sm font-medium mb-2">Description</h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedPrompt.description}
                    </p>
                  </div>

                  {/* Prompt Content */}
                  <div>
                    <h3 className="text-sm font-medium mb-2">Prompt Content</h3>
                    <div className="bg-muted p-4 rounded-lg">
                      <pre className="text-sm whitespace-pre-wrap">
                        {selectedPrompt.content}
                      </pre>
                    </div>
                  </div>

                  {/* Tags */}
                  <div>
                    <h3 className="text-sm font-medium mb-2">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {(selectedPrompt.tags ?? []).map((tagObj: { tag: { id: string; name: string; color?: string } }) => (
                        <Badge key={tagObj.tag.id} variant="secondary" className="text-xs">
                          <Tag className="h-3 w-3 mr-1" />
                          {tagObj.tag.name}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Rating and Favorites */}
                  <div>
                    <h3 className="text-sm font-medium mb-2">Rating & Favorites</h3>
                    <RatingComponent
                      promptId={selectedPrompt.id}
                      currentRating={selectedPrompt.averageRating}
                      totalRatings={selectedPrompt.totalRatings}
                      isFavorite={selectedPrompt.isFavorite}
                      onRatingChange={handleRatingChange}
                      onFavoriteToggle={handleToggleFavorite}
                      userRating={selectedPrompt.userRating}
                      userComment={selectedPrompt.userComment}
                      showDetails={true}
                    />
                  </div>

                  {/* Parameters */}
                  <div>
                    <h3 className="text-sm font-medium mb-2">Parameters</h3>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <span className="text-xs text-muted-foreground">Target Model</span>
                        <p className="text-sm font-medium">{selectedPrompt.targetModel}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Temperature</span>
                        <p className="text-sm font-medium">{selectedPrompt.temperature}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Max Tokens</span>
                        <p className="text-sm font-medium">{selectedPrompt.maxTokens}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Top P</span>
                        <p className="text-sm font-medium">{selectedPrompt.topP}</p>
                      </div>
                    </div>
                  </div>

                  {/* Mobile Action Buttons */}
                  <div className="flex flex-col gap-2 pt-4 border-t">
                    <VersionManager
                      prompt={selectedPrompt}
                      onClone={handleVersionClone}
                    />
                    <Button 
                      variant="outline" 
                      onClick={() => setIsEditDialogOpen(true)}
                      className="w-full"
                    >
                      Edit Prompt
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            </div>
          </div>
        )}
      </div>

      {/* Create Prompt Dialog */}
      <PromptForm
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSubmit={handleCreatePrompt}
        categories={categories.filter(c => c.id !== "all").map(c => ({ id: c.id, name: c.name }))}
      />

      {/* Edit Prompt Dialog */}
      {selectedPrompt && (
        <PromptForm
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onSubmit={handleEditPrompt}
          initialData={{
            title: selectedPrompt.title,
            content: selectedPrompt.content,
            description: selectedPrompt.description,
            targetModel: selectedPrompt.targetModel,
            temperature: selectedPrompt.temperature,
            maxTokens: selectedPrompt.maxTokens,
            topP: selectedPrompt.topP,
            frequencyPenalty: selectedPrompt.frequencyPenalty,
            presencePenalty: selectedPrompt.presencePenalty,
            notes: selectedPrompt.notes,
            categoryId: selectedPrompt.category?.id,
            tags: (selectedPrompt.tags ?? []).map((tag) => tag.tag.name),
          }}
          categories={categories.filter(c => c.id !== "all").map(c => ({ id: c.id, name: c.name }))}
        />
      )}

      {/* Prompt Transformer Dialog */}
      <PromptTransformer
        open={isTransformerOpen}
        onOpenChange={setIsTransformerOpen}
      />
    </div>
  );
}