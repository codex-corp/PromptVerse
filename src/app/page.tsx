// app/page.tsx
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
    Filter,
    Folder,
    Tag,
    BookOpen,
    Zap,
    Layers,
    Edit3,
    Star as StarIcon,
    Copy as CopyIcon,
    Code,
    FileText,
    Trash2 as Trash2Icon,
    ChevronDown as ChevronDownIcon,
    Menu as MenuIcon,
    User as UserIcon,
    Eye as EyeIcon,
    Code as CodeIcon,
    FileText as FileTextIcon,
    GitBranch as GitBranchIcon,
    RotateCcw as RotateCcwIcon, PlusIcon, Wand2, UploadIcon, SettingsIcon, DownloadIcon

} from "lucide-react";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useToast } from "@/hooks/use-toast";

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
    const [initialDataForCreate, setInitialDataForCreate] = useState<any | undefined>(undefined);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [isMobile, setIsMobile] = useState(false);

    const handleAddToPrompts = (data: any) => {
        setInitialDataForCreate({
            title: data.title,
            content: data.content,
            description: data.description,
            targetModel: data.targetModel,
            tags: data.tags,
        });
        setIsTransformerOpen(false);
        setIsCreateDialogOpen(true);
    };

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
            setDefaultUser(firstUser as { id: string; name: string; email: string } | null);
            return firstUser as { id: string; name: string; email: string } | null;
        } catch (err) {
            console.error("Error fetching default user:", err);
            setDefaultUser(null);
            return null;
        }
    }, []);

    // Fetch prompts from API
    const fetchPrompts = useCallback(async () => {
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
    }, [filters]);

    // Fetch categories from API
    const fetchCategories = useCallback(async () => {
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
                { id: "code", name: "Code Generation", count: 0, icon: Code },
                { id: "creative", name: "Creative Writing", count: 0, icon: FileText },
                { id: "analysis", name: "Analysis", count: 0, icon: Filter },
                { id: "business", name: "Business", count: 0, icon: Layers },
            ]);
        }
    }, []);

    // Initial data fetch
    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    useEffect(() => {
        fetchDefaultUser();
    }, [fetchDefaultUser]);

    // Refresh lists whenever filters change or a new prompt is created elsewhere.
    useEffect(() => {
        fetchPrompts();

        const handlePromptAdded = () => {
            fetchPrompts();
            fetchCategories();
        };

        window.addEventListener("promptverse:prompt-added", handlePromptAdded);
        return () => {
            window.removeEventListener("promptverse:prompt-added", handlePromptAdded);
        };
    }, [fetchPrompts, fetchCategories]);

    // Handle responsive layout
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
            if (window.innerWidth < 768) {
                setSidebarOpen(false);
            } else {
                setSidebarOpen(true);
            }
        };

        checkMobile();
        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    // Filter prompts based on selected category (from left panel)
    const filteredPrompts = useMemo(() => {
        if (selectedCategory === "all") return prompts;
        return prompts.filter(prompt => prompt.category?.id === selectedCategory);
    }, [prompts, selectedCategory]);

    // Generate available tags and models for filter panel
    const allTags = useMemo(() => {
        return prompts.reduce((acc, prompt) => {
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
    }, [prompts]);

    const allModels = useMemo(() => {
        return prompts.reduce((acc, prompt) => {
            if (!prompt.targetModel) return acc;
            const existing = acc.find(m => m.name === prompt.targetModel);
            if (existing) {
                existing.count++;
            } else {
                acc.push({ name: prompt.targetModel, count: 1 });
            }
            return acc;
        }, [] as Array<{ name: string; count: number }>);
    }, [prompts]);

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

    const { toast } = useToast();

    const handleCopyPrompt = (content: string) => {
        navigator.clipboard.writeText(content).then(() => {
            toast({
                title: "Copied to clipboard!",
                description: "The prompt content has been copied to your clipboard."
            });
        });
    };

    const handleDeletePrompt = async (promptId: string) => {
        try {
            const response = await fetch(`/api/prompts/${promptId}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                throw new Error("Failed to delete prompt");
            }

            await fetchPrompts(); // Refresh the prompts list
            toast({
                title: "Prompt deleted",
                description: "The prompt has been successfully deleted."
            });
        } catch (error) {
            console.error("Error deleting prompt:", error);
            toast({
                title: "Error",
                description: "Failed to delete the prompt.",
                variant: "destructive"
            });
        }
    };

    const handleCardClick = useCallback(async (prompt: Prompt) => {
        setSelectedPrompt(prompt);
        try {
            const response = await fetch(`/api/prompts/${prompt.id}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ viewCount: prompt.viewCount + 1 }),
                });
            if (!response.ok) {
                throw new Error("Failed to update view count");
            }
            // Optimistically update the UI
            setPrompts(prompts.map(p => p.id === prompt.id ? { ...p, viewCount: p.viewCount + 1 } : p));
        } catch (error) {
            console.error("Error updating view count:", error);
        }
    }, [prompts]);

    // Memoized category options for mobile dropdown
    const categoryOptions = useMemo(() => {
        return categories.map((category) => {
            const Icon = category.icon;
            return (
                <option key={category.id} value={category.id}>
                    {category.name} ({category.count})
                </option>
            );
        });
    }, [categories]);

    // Memoized prompt list items
    const promptListItems = useMemo(() => {
        return filteredPrompts.map((prompt) => (
            <ContextMenu key={prompt.id}>
                <ContextMenuTrigger>
                    <Card
                        className={`cursor-pointer transition-all hover:shadow-md hover:ring-1 hover:ring-primary/30 ${selectedPrompt?.id === prompt.id ? "ring-2 ring-primary bg-primary/5" : ""} mb-4`}>
                        <CardContent className="p-4" onClick={() => handleCardClick(prompt)}>
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
                                <div className="flex items-center space-x-2">
                                    <UserIcon className="h-3 w-3" />
                                    <span>{prompt.author.name}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <EyeIcon className="h-3 w-3" />
                                    <span>{prompt.viewCount}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </ContextMenuTrigger>
                <ContextMenuContent>
                    <ContextMenuItem onClick={() => {
                        setSelectedPrompt(prompt);
                        setIsEditDialogOpen(true);
                    }}>
                        <Edit3 className="h-4 w-4 mr-2" />
                        Edit
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => handleCopyPrompt(prompt.content)}>
                        <CopyIcon className="h-4 w-4 mr-2" />
                        Copy
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => handleDeletePrompt(prompt.id)}>
                        <Trash2Icon className="h-4 w-4 mr-2" />
                        Delete
                    </ContextMenuItem>
                </ContextMenuContent>
            </ContextMenu>
        ));
    }, [filteredPrompts, selectedPrompt, handleRatingChange, handleToggleFavorite, handleCardClick]);

    return (
        <div className="h-screen bg-background flex flex-col">
            {/* Header */}
            <div className="border-b bg-card">
                <div className="flex h-16 items-center px-4">
                    <div className="flex items-center space-x-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                        >
                            <MenuIcon className="h-5 w-5" />
                        </Button>
                        <div className="flex items-center space-x-2">
                            <BookOpen className="h-6 w-6 text-primary" />
                            <h1 className="text-xl font-semibold">PromptVerse</h1>
                        </div>
                    </div>
                    <div className="ml-auto flex items-center space-x-2">
                        <AdvancedSearch
                            searchQuery={filters.search}
                            onSearchChange={handleSearchChange}
                            prompts={prompts}
                        />
                        <Button size="sm" onClick={() => setIsCreateDialogOpen(true)}>
                            <PlusIcon className="h-4 w-4 mr-2" />
                            New Prompt
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setIsTransformerOpen(true)}>
                            <Wand2 className="h-4 w-4 mr-2" />
                            Transform
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
                            <SettingsIcon className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Mobile First - Show Categories as Dropdown */}
                <div className="md:hidden border-b bg-card p-4">
                    <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="w-full p-2 border rounded-md bg-background"
                    >
                        {categoryOptions}
                    </select>
                </div>

                <ResizablePanelGroup direction="horizontal" className="flex-1">
                    {/* Left Panel - Categories (Hidden on Mobile) */}
                    {sidebarOpen && (
                        <>
                            <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
                                <Card className="h-full rounded-none border-0">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm font-medium flex items-center justify-between">
                                            <span>Categories</span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                                onClick={() => setSidebarOpen(false)}
                                            >
                                                <ChevronDownIcon className="h-4 w-4 rotate-90" />
                                            </Button>
                                        </CardTitle>
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
                        </>
                    )}

                    {/* Middle Panel - Prompt List */}
                    <ResizablePanel defaultSize={sidebarOpen ? 35 : 50} minSize={25} maxSize={70}>
                        <Card className="h-full rounded-none border-0">
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm font-medium">
                                        Prompts ({filteredPrompts.length})
                                    </CardTitle>
                                    <div className="flex items-center space-x-2">
                                        <Button variant="outline" size="sm">
                                            <DownloadIcon className="h-4 w-4 mr-2" />
                                            Export
                                        </Button>
                                        <Button variant="outline" size="sm">
                                            <UploadIcon className="h-4 w-4 mr-2" />
                                            Import
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <ScrollArea className="h-[calc(100vh-8rem)]">
                                    <div className="p-3">
                                        {loading ? (
                                            <div className="flex items-center justify-center h-32">
                                                <div className="text-muted-foreground">Loading prompts...</div>
                                            </div>
                                        ) : error ? (
                                            <div className="flex items-center justify-center h-32">
                                                <div className="text-red-500">Error: {error}</div>
                                            </div>
                                        ) : filteredPrompts.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-32 text-center">
                                                <FileTextIcon className="h-10 w-10 text-muted-foreground mb-2" />
                                                <p className="text-sm text-muted-foreground">No prompts found</p>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="mt-2"
                                                    onClick={() => setIsCreateDialogOpen(true)}
                                                >
                                                    <PlusIcon className="h-4 w-4 mr-2" />
                                                    Create New Prompt
                                                </Button>
                                            </div>
                                        ) : (
                                            promptListItems
                                        )}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </ResizablePanel>

                    <ResizableHandle withHandle />

                    {/* Right Panel - Prompt Details (Hidden on Mobile when not selected) */}
                    <ResizablePanel defaultSize={45} minSize={25} maxSize={70} className={isMobile && !selectedPrompt ? "hidden" : ""}>
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
                                                    onClick={() => handleCopyPrompt(selectedPrompt.content)}
                                                >
                                                    <CopyIcon className="h-4 w-4 mr-2" />
                                                    Copy
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setIsEditDialogOpen(true)}
                                                >
                                                    <Edit3 className="h-4 w-4 mr-2" />
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
                                                    <h3 className="text-sm font-medium mb-2 flex items-center">
                                                        <FileTextIcon className="h-4 w-4 mr-2" />
                                                        Description
                                                    </h3>
                                                    <p className="text-sm text-muted-foreground">
                                                        {selectedPrompt.description}
                                                    </p>
                                                </div>

                                                {/* Prompt Content */}
                                                <div>
                                                    <h3 className="text-sm font-medium mb-2 flex items-center">
                                                        <CodeIcon className="h-4 w-4 mr-2" />
                                                        Prompt Content
                                                    </h3>
                                                    <div className="bg-muted p-4 rounded-lg">
                            <pre className="text-sm whitespace-pre-wrap">
                              {selectedPrompt.content}
                            </pre>
                                                    </div>
                                                </div>

                                                {/* Tags */}
                                                <div>
                                                    <h3 className="text-sm font-medium mb-2 flex items-center">
                                                        <Tag className="h-4 w-4 mr-2" />
                                                        Tags
                                                    </h3>
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
                                                    <h3 className="text-sm font-medium mb-2 flex items-center">
                                                        <StarIcon className="h-4 w-4 mr-2" />
                                                        Rating & Favorites
                                                    </h3>
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
                                                    <h3 className="text-sm font-medium mb-2 flex items-center">
                                                        <SettingsIcon className="h-4 w-4 mr-2" />
                                                        Parameters
                                                    </h3>
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
                                                        <h3 className="text-sm font-medium mb-2 flex items-center">
                                                            <FileTextIcon className="h-4 w-4 mr-2" />
                                                            Notes
                                                        </h3>
                                                        <p className="text-sm text-muted-foreground">
                                                            {selectedPrompt.notes}
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Metadata */}
                                                <div>
                                                    <h3 className="text-sm font-medium mb-2 flex items-center">
                                                        <UserIcon className="h-4 w-4 mr-2" />
                                                        Metadata
                                                    </h3>
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
            </div>

            {/* Create Prompt Dialog */}
            <PromptForm
                open={isCreateDialogOpen}
                onOpenChange={(open) => {
                    setIsCreateDialogOpen(open);
                    if (!open) {
                        setInitialDataForCreate(undefined); // Reset when closed
                    }
                }}
                onSubmit={handleCreatePrompt}
                categories={categories.filter(c => c.id !== "all").map(c => ({ id: c.id, name: c.name }))}
                initialData={initialDataForCreate}
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
                authorId={defaultUser?.id ?? null}
                onPromptAdded={fetchPrompts}
            />
        </div>
    );
}
