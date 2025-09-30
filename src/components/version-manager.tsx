// components/version-manager.tsx
"use client";

import { useState, useMemo } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
    Copy,
    GitBranch,
    Clock,
    User,
    MessageSquare,
    ArrowRight,
    CheckCircle,
    AlertCircle,
    X,
    FileText,
    Settings,
    Zap,
    MoreHorizontal,
    Pencil,
    Trash2,
    Copy as CopyIcon,
    Share2,
    Archive,
    ArchiveX,
    Star,
    StarOff,
    Heart,
    HeartOff,
    Menu,
    ChevronDown,
    Layers,
    Eye,
    Download,
    Upload,
    Search,
    Filter,
    Plus,
    Pencil as PencilIcon,
    Trash2 as Trash2Icon,
    Share2 as Share2Icon,
    Archive as ArchiveIcon,
    ArchiveX as ArchiveXIcon,
    Star as StarIcon,
    StarOff as StarOffIcon,
    Heart as HeartIcon,
    HeartOff as HeartOffIcon,
    MoreHorizontal as MoreHorizontalIcon,
    Menu as MenuIcon,
    ChevronDown as ChevronDownIcon,
    Layers as LayersIcon,
    Clock as ClockIcon,
    User as UserIcon,
    Eye as EyeIcon,
    Download as DownloadIcon,
    Upload as UploadIcon,
    Search as SearchIcon,
    Filter as FilterIcon,
    Settings as SettingsIcon,
    Plus as PlusIcon,
    FileText as FileTextIcon,
    GitBranch as GitBranchIcon,
    RotateCcw as RotateCcwIcon,
} from "lucide-react";

interface Version {
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
    versionNote: string;
    createdAt: string;
    author: string;
}

interface PromptVersion {
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
    versions?: Version[];
}

interface VersionManagerProps {
    prompt: PromptVersion;
    onClone: (originalPromptId: string, cloneData: {
        title: string;
        versionNote: string;
        updates: Partial<PromptVersion>;
    }) => void;
    onRevert?: (versionId: string) => void;
}

export function VersionManager({
                                   prompt,
                                   onClone,
                                   onRevert
                               }: VersionManagerProps) {
    const [isCloneDialogOpen, setIsCloneDialogOpen] = useState(false);
    const [cloneTitle, setCloneTitle] = useState(`${prompt.title} (Clone)`);
    const [versionNote, setVersionNote] = useState("");
    const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
    const [isCompareMode, setIsCompareMode] = useState(false);
    const [compareVersion, setCompareVersion] = useState<Version | null>(null);

    const handleClone = () => {
        onClone(prompt.id, {
            title: cloneTitle,
            versionNote,
            updates: {
                title: cloneTitle,
            }
        });
        setIsCloneDialogOpen(false);
        setCloneTitle(`${prompt.title} (Clone)`);
        setVersionNote("");
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    };

    const getVersionChanges = (older: Version, newer: Version) => {
        const changes = [];

        if (older.title !== newer.title) {
            changes.push({ field: "Title", old: older.title, new: newer.title });
        }
        if (older.content !== newer.content) {
            changes.push({ field: "Content", old: older.content, new: newer.content });
        }
        if (older.description !== newer.description) {
            changes.push({
                field: "Description",
                old: older.description || "",
                new: newer.description || ""
            });
        }
        if (older.targetModel !== newer.targetModel) {
            changes.push({ field: "Target Model", old: older.targetModel, new: newer.targetModel });
        }
        if (older.temperature !== newer.temperature) {
            changes.push({
                field: "Temperature",
                old: older.temperature?.toString() || "",
                new: newer.temperature?.toString() || ""
            });
        }
        if (older.maxTokens !== newer.maxTokens) {
            changes.push({
                field: "Max Tokens",
                old: older.maxTokens?.toString() || "",
                new: newer.maxTokens?.toString() || ""
            });
        }
        if (older.topP !== newer.topP) {
            changes.push({
                field: "Top P",
                old: older.topP?.toString() || "",
                new: newer.topP?.toString() || ""
            });
        }
        if (older.frequencyPenalty !== newer.frequencyPenalty) {
            changes.push({
                field: "Frequency Penalty",
                old: older.frequencyPenalty?.toString() || "",
                new: newer.frequencyPenalty?.toString() || ""
            });
        }
        if (older.presencePenalty !== newer.presencePenalty) {
            changes.push({
                field: "Presence Penalty",
                old: older.presencePenalty?.toString() || "",
                new: newer.presencePenalty?.toString() || ""
            });
        }
        if (older.notes !== newer.notes) {
            changes.push({
                field: "Notes",
                old: older.notes || "",
                new: newer.notes || ""
            });
        }

        return changes;
    };

    const CloneDialog = () => (
        <Dialog open={isCloneDialogOpen} onOpenChange={setIsCloneDialogOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <CopyIcon className="h-4 w-4 mr-2" />
                    Clone Version
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <GitBranchIcon className="h-5 w-5" />
                        Clone Prompt
                    </DialogTitle>
                    <DialogDescription>
                        Create a new version of this prompt. The original will remain unchanged.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">New Title</label>
                        <Input
                            value={cloneTitle}
                            onChange={(e) => setCloneTitle(e.target.value)}
                            placeholder="Enter title for the cloned prompt"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Version Note</label>
                        <Textarea
                            value={versionNote}
                            onChange={(e) => setVersionNote(e.target.value)}
                            placeholder="Describe what changed in this version..."
                            rows={3}
                        />
                        <p className="text-xs text-muted-foreground">
                            This note will help you and others understand the purpose of this version.
                        </p>
                    </div>

                    <div className="bg-muted/50 p-3 rounded-lg">
                        <h4 className="text-sm font-medium mb-2">Original Prompt</h4>
                        <div className="text-xs space-y-1">
                            <div><strong>Title:</strong> {prompt.title}</div>
                            <div><strong>Model:</strong> {prompt.targetModel}</div>
                            <div><strong>Created:</strong> {formatDate(prompt.versions?.[0]?.createdAt || "")}</div>
                        </div>
                    </div>

                    <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => setIsCloneDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleClone} disabled={!cloneTitle.trim() || !versionNote.trim()}>
                            Create Clone
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );

    const VersionComparison = ({ version1, version2 }: { version1: Version; version2: Version }) => {
        const changes = useMemo(() => getVersionChanges(version1, version2), [version1, version2]);
        const isOlder = new Date(version1.createdAt) < new Date(version2.createdAt);

        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="truncate max-w-[150px]">{version1.title}</Badge>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <Badge variant="outline" className="truncate max-w-[150px]">{version2.title}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                        {isOlder ? "Older → Newer" : "Newer → Older"}
                    </div>
                </div>

                {changes.length === 0 ? (
                    <div className="flex items-center space-x-2 text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm">No differences found between versions</span>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="flex items-center space-x-2 text-orange-600">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-sm">{changes.length} change{changes.length !== 1 ? "s" : ""} found</span>
                        </div>

                        <ScrollArea className="max-h-60">
                            <div className="space-y-3">
                                {changes.map((change, index) => (
                                    <div key={index} className="border rounded-lg p-3">
                                        <div className="font-medium text-sm mb-2">{change.field}</div>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div>
                                                <div className="text-muted-foreground mb-1">Before:</div>
                                                <div className="bg-red-50 dark:bg-red-950 p-2 rounded text-red-800 dark:text-red-200 whitespace-pre-wrap">
                                                    {change.old.length > 100 ? change.old.substring(0, 100) + "..." : change.old}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-muted-foreground mb-1">After:</div>
                                                <div className="bg-green-50 dark:bg-green-950 p-2 rounded text-green-800 dark:text-green-200 whitespace-pre-wrap">
                                                    {change.new.length > 100 ? change.new.substring(0, 100) + "..." : change.new}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                )}
            </div>
        );
    };

    const currentVersion = prompt.versions?.[0] || null;
    const previousVersions = prompt.versions?.slice(1) || [];

    return (
        <div className="space-y-4">
            {/* Clone Button */}
            <CloneDialog />

            {/* Version History */}
            <div className="space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                    <GitBranchIcon className="h-4 w-4" />
                    Version History ({prompt.versions?.length || 0})
                </h4>

                <ScrollArea className="max-h-64">
                    <div className="space-y-2">
                        {/* Current version */}
                        {currentVersion && (
                            <div className="border rounded-lg p-3 bg-primary/5">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-2 mb-1">
                                            <Badge variant="default">Current</Badge>
                                            <span className="font-medium text-sm truncate">{currentVersion.title}</span>
                                        </div>
                                        <div className="text-xs text-muted-foreground space-y-1">
                                            <div className="flex items-center space-x-1">
                                                <UserIcon className="h-3 w-3" />
                                                <span>{currentVersion.author}</span>
                                            </div>
                                            <div className="flex items-center space-x-1">
                                                <ClockIcon className="h-3 w-3" />
                                                <span>{formatDate(currentVersion.createdAt)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setSelectedVersion(currentVersion);
                                            setIsCompareMode(true);
                                        }}
                                    >
                                        Compare
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Previous versions */}
                        {previousVersions.map((version) => (
                            <div key={version.id} className="border rounded-lg p-3">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-2 mb-1">
                                            <span className="font-medium text-sm truncate">{version.title}</span>
                                            {version.versionNote && (
                                                <MessageSquare className="h-3 w-3 text-muted-foreground" />
                                            )}
                                        </div>
                                        <div className="text-xs text-muted-foreground space-y-1">
                                            <div className="flex items-center space-x-1">
                                                <UserIcon className="h-3 w-3" />
                                                <span>{version.author}</span>
                                            </div>
                                            <div className="flex items-center space-x-1">
                                                <ClockIcon className="h-3 w-3" />
                                                <span>{formatDate(version.createdAt)}</span>
                                            </div>
                                            {version.versionNote && (
                                                <div className="bg-muted p-2 rounded text-xs mt-1">
                                                    {version.versionNote}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex space-x-1">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                if (isCompareMode && selectedVersion) {
                                                    setCompareVersion(version);
                                                } else {
                                                    setSelectedVersion(version);
                                                    setIsCompareMode(true);
                                                }
                                            }}
                                        >
                                            {isCompareMode && selectedVersion ? "Compare" : "View"}
                                        </Button>
                                        {onRevert && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => onRevert(version.id)}
                                            >
                                                Revert
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </div>

            {/* Version Comparison Dialog */}
            {isCompareMode && selectedVersion && (
                <Dialog open={isCompareMode} onOpenChange={setIsCompareMode}>
                    <DialogContent className="max-w-4xl max-h-[80vh]">
                        <DialogHeader>
                            <DialogTitle className="flex items-center justify-between">
                                <span>Version Comparison</span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setIsCompareMode(false)}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </DialogTitle>
                            <DialogDescription>
                                Compare differences between prompt versions
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4">
                            {compareVersion ? (
                                <VersionComparison version1={selectedVersion} version2={compareVersion} />
                            ) : (
                                <div className="space-y-4">
                                    <div className="text-center">
                                        <p className="text-sm text-muted-foreground mb-4">
                                            Select another version to compare with "{selectedVersion.title}"
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 gap-2">
                                        {(prompt.versions || [])
                                            .filter(v => v.id !== selectedVersion.id)
                                            .map(version => (
                                                <Button
                                                    key={version.id}
                                                    variant="outline"
                                                    className="justify-start h-auto p-3 text-left"
                                                    onClick={() => setCompareVersion(version)}
                                                >
                                                    <div>
                                                        <div className="font-medium">{version.title}</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {formatDate(version.createdAt)} • {version.author}
                                                        </div>
                                                    </div>
                                                </Button>
                                            ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end">
                                <Button variant="outline" onClick={() => setIsCompareMode(false)}>
                                    Close
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}