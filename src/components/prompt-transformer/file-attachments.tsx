"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatFileSize, getFileExtension } from "./utils";

export type UploadedFileState = {
    id: string;
    file: File;
    name: string;
    size: number;
    preview?: string;
    previewOpen: boolean;
    status: "idle" | "parsing" | "parsed" | "error";
    content?: string;
    addedAt: number;
};

type PromptTransformerFileAttachmentsProps = {
    acceptedExtensions: string[];
    files: UploadedFileState[];
    onFilesAdded: (files: FileList | File[]) => void;
    onRemoveFile: (id: string) => void;
    onRemoveAll: () => void;
    onTogglePreview: (id: string) => void;
    onInjectFile: (id: string) => void;
    onOptimizeFile: (id: string) => void;
};

export function PromptTransformerFileAttachments({
    acceptedExtensions,
    files,
    onFilesAdded,
    onRemoveFile,
    onRemoveAll,
    onTogglePreview,
    onInjectFile,
    onOptimizeFile,
}: PromptTransformerFileAttachmentsProps) {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const dragCounterRef = useRef(0);
    const [isDragActive, setIsDragActive] = useState(false);

    const handleBrowseClick = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleFileInputChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            if (event.target.files) {
                onFilesAdded(event.target.files);
                event.target.value = "";
            }
        },
        [onFilesAdded]
    );

    const handleDropZoneKeyDown = useCallback(
        (event: KeyboardEvent<HTMLDivElement>) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleBrowseClick();
            }
        },
        [handleBrowseClick]
    );

    const handleDragEnter = useCallback((event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        dragCounterRef.current += 1;
        setIsDragActive(true);
    }, []);

    const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
        if (dragCounterRef.current === 0) {
            setIsDragActive(false);
        }
    }, []);

    const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = "copy";
        }
    }, []);

    const handleDrop = useCallback(
        (event: DragEvent<HTMLDivElement>) => {
            event.preventDefault();
            event.stopPropagation();
            dragCounterRef.current = 0;
            setIsDragActive(false);

            const items = event.dataTransfer?.files;
            if (items && items.length) {
                onFilesAdded(items);
            }
        },
        [onFilesAdded]
    );

    const acceptedLabel = useMemo(
        () =>
            acceptedExtensions
                .map((extension) => extension.replace(".", "").toUpperCase())
                .join(", "),
        [acceptedExtensions]
    );

    return (
        <div className="space-y-3" data-tour-id="tour-file-upload">
            <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={acceptedExtensions.join(",")}
                className="sr-only"
                onChange={handleFileInputChange}
                aria-hidden="true"
            />
            <div
                role="button"
                tabIndex={0}
                aria-label="Upload files to include in the prompt context"
                onClick={handleBrowseClick}
                onKeyDown={handleDropZoneKeyDown}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={cn(
                    "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/40"
                )}
            >
                <p className="text-sm font-medium text-foreground">
                    {isDragActive ? "Drop files here" : "Drag and drop files"}
                </p>
                <p className="text-xs text-muted-foreground">or click to browse</p>
                <p className="text-[11px] text-muted-foreground">Accepted: {acceptedLabel}</p>
                <p className="sr-only" aria-live="polite">
                    {files.length} file{files.length === 1 ? "" : "s"} selected
                </p>
            </div>

            {files.length > 0 && (
                <div className="space-y-2" aria-live="polite">
                    <div className="flex items-center justify-between gap-2">
                        <h5 className="text-sm font-medium">Uploaded files</h5>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={onRemoveAll}
                            aria-label="Remove all uploaded files"
                        >
                            Remove all
                        </Button>
                    </div>
                    <div role="list" className="flex flex-col gap-3">
                        {files.map((file) => {
                            const previewId = `file-preview-${file.id}`;
                            const extension = getFileExtension(file.name).replace(".", "").toUpperCase();

                            return (
                                <div key={file.id} role="listitem" className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => onTogglePreview(file.id)}
                                            className={cn(
                                                "group flex flex-1 items-center justify-between gap-2 rounded-full border bg-background/80 px-3 py-1 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                                file.previewOpen ? "border-primary bg-primary/10" : "border-border"
                                            )}
                                            aria-expanded={file.previewOpen}
                                            aria-controls={previewId}
                                        >
                                            <span className="flex items-center gap-2">
                                                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground">
                                                    {extension || "FILE"}
                                                </span>
                                                <span className="font-medium text-foreground">{file.name}</span>
                                            </span>
                                            <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                                <span>{formatFileSize(file.size)}</span>
                                                {file.status === "parsing" && (
                                                    <span className="flex items-center gap-1 text-primary">
                                                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                                                        Parsing…
                                                    </span>
                                                )}
                                            </span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onOptimizeFile(file.id)}
                                            className="inline-flex h-7 items-center justify-center rounded-full border border-transparent px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                            aria-label={`Optimize context for ${file.name}`}
                                        >
                                            Optimize Context
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onInjectFile(file.id)}
                                            className="inline-flex h-7 items-center justify-center rounded-full border border-transparent px-3 text-xs font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                            aria-label={`Inject content of ${file.name}`}
                                        >
                                            Inject
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onRemoveFile(file.id)}
                                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-transparent text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                            aria-label={`Remove ${file.name}`}
                                        >
                                            <X className="h-3 w-3" aria-hidden="true" />
                                        </button>
                                    </div>
                                    {file.previewOpen && (
                                        <div
                                            id={previewId}
                                            role="region"
                                            aria-live="polite"
                                            className="rounded-lg border border-dashed border-border/60 bg-muted/30 px-3 py-2 text-xs"
                                        >
                                            {file.status === "parsing" && (
                                                <div className="flex items-center gap-2 text-primary">
                                                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                                                    Loading preview…
                                                </div>
                                            )}
                                            {file.status === "error" && file.preview && (
                                                <p className="text-xs text-destructive">{file.preview}</p>
                                            )}
                                            {file.status !== "parsing" && file.status !== "error" && (
                                                <pre className="whitespace-pre-wrap break-words font-mono text-xs text-foreground">
                                                    {file.preview || "Preview will be available when parsing completes."}
                                                </pre>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
