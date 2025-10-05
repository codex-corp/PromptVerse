import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { EngineeringTemplate, TemplateCategory } from "./templates-data";

interface TemplatesPanelProps {
    categories: TemplateCategory[];
    mode: "standard" | "chatgpt";
    onApply: (template: EngineeringTemplate) => void;
}

export function TemplatesPanel({ categories, mode, onApply }: TemplatesPanelProps) {
    const [activeCategoryId, setActiveCategoryId] = useState(() => categories[0]?.id ?? "");
    const activeCategory = useMemo(
        () => categories.find((category) => category.id === activeCategoryId) ?? categories[0],
        [activeCategoryId, categories]
    );

    return (
        <div className="rounded-2xl border bg-card shadow-sm" data-tour-id="templates-panel">
            <div className="border-b px-5 py-4">
                <div className="flex items-center justify-between gap-2">
                    <div>
                        <p className="text-sm font-medium tracking-tight">Engineering templates</p>
                        <p className="text-xs text-muted-foreground">Drop in a ready-to-tailor prompt for common build, quality, or ops tasks.</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                        {mode === "chatgpt" ? "ChatGPT" : "Standard"}
                    </Badge>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 px-5 py-4">
                <div className="flex flex-wrap gap-2">
                    {categories.map((category) => (
                        <Button
                            key={category.id}
                            variant={category.id === activeCategory?.id ? "default" : "outline"}
                            size="sm"
                            className="rounded-full"
                            onClick={() => setActiveCategoryId(category.id)}
                        >
                            {category.title}
                        </Button>
                    ))}
                </div>

                {activeCategory ? (
                    <div className="space-y-3">
                        <p className="text-xs text-muted-foreground">{activeCategory.description}</p>
                        <ScrollArea className="h-[420px] pr-2">
                            <div className="space-y-4">
                                {activeCategory.templates.map((template) => {
                                    const preview = mode === "chatgpt" ? template.chatgpt : template.standard;
                                    return (
                                        <div key={template.id} className="rounded-xl border border-border/60 bg-background/80 p-4 shadow-sm">
                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                <div className="space-y-1">
                                                    <div className="flex flex-wrap gap-2">
                                                        {template.tags.map((tag) => (
                                                            <Badge key={tag} variant="secondary" className="text-[10px] uppercase">
                                                                {tag}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                    <h3 className="text-sm font-semibold text-foreground">{template.title}</h3>
                                                    <p className="text-xs text-muted-foreground">{template.objective}</p>
                                                </div>
                                                <Button size="sm" onClick={() => onApply(template)}>
                                                    Use template
                                                </Button>
                                            </div>
                                            <p className="mt-3 text-xs text-muted-foreground">{template.scenario}</p>
                                            <div className="mt-3 rounded-lg border border-dashed border-border/60 bg-muted/30 p-3">
                                                <p className="text-[11px] font-medium text-muted-foreground uppercase">Prompt preview ({mode})</p>
                                                <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
{preview}
                                                </pre>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    </div>
                ) : (
                    <p className="text-xs text-muted-foreground">No templates available.</p>
                )}
            </div>
        </div>
    );
}

export default TemplatesPanel;
