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
  AlertCircle
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
  versions: Version[];
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
        // You can include any updates to the original prompt here
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

    return changes;
  };

  const CloneDialog = () => (
    <Dialog open={isCloneDialogOpen} onOpenChange={setIsCloneDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Copy className="h-4 w-4 mr-2" />
          Clone Version
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
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

          <div className="bg-muted p-3 rounded-lg">
            <h4 className="text-sm font-medium mb-2">Original Prompt</h4>
            <div className="text-xs space-y-1">
              <div><strong>Title:</strong> {prompt.title}</div>
              <div><strong>Model:</strong> {prompt.targetModel}</div>
              <div><strong>Created:</strong> {formatDate(prompt.versions[0]?.createdAt || "")}</div>
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
    const changes = getVersionChanges(version1, version2);
    const isOlder = new Date(version1.createdAt) < new Date(version2.createdAt);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Badge variant="outline">{version1.title}</Badge>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <Badge variant="outline">{version2.title}</Badge>
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
                        <div className="bg-red-50 dark:bg-red-950 p-2 rounded text-red-800 dark:text-red-200">
                          {change.old.length > 100 ? change.old.substring(0, 100) + "..." : change.old}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground mb-1">After:</div>
                        <div className="bg-green-50 dark:bg-green-950 p-2 rounded text-green-800 dark:text-green-200">
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

  return (
    <div className="space-y-4">
      {/* Clone Button */}
      <CloneDialog />

      {/* Version History */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <GitBranch className="h-4 w-4" />
          Version History ({prompt.versions.length})
        </h4>
        
        <ScrollArea className="max-h-64">
          <div className="space-y-2">
            {/* Current version */}
            <div className="border rounded-lg p-3 bg-primary/5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <Badge variant="default">Current</Badge>
                    <span className="font-medium text-sm">{prompt.title}</span>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div className="flex items-center space-x-1">
                      <User className="h-3 w-3" />
                      <span>{prompt.versions[0]?.author || "Unknown"}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Clock className="h-3 w-3" />
                      <span>{formatDate(prompt.versions[0]?.createdAt || "")}</span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedVersion(prompt.versions[0]);
                    setIsCompareMode(true);
                  }}
                >
                  Compare
                </Button>
              </div>
            </div>

            {/* Previous versions */}
            {prompt.versions.slice(1).map((version, index) => (
              <div key={version.id} className="border rounded-lg p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="font-medium text-sm">{version.title}</span>
                      {version.versionNote && (
                        <MessageSquare className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div className="flex items-center space-x-1">
                        <User className="h-3 w-3" />
                        <span>{version.author}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Clock className="h-3 w-3" />
                        <span>{formatDate(version.createdAt)}</span>
                      </div>
                      {version.versionNote && (
                        <div className="bg-muted p-2 rounded text-xs">
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
              <DialogTitle>Version Comparison</DialogTitle>
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
                    {prompt.versions
                      .filter(v => v.id !== selectedVersion.id)
                      .map(version => (
                        <Button
                          key={version.id}
                          variant="outline"
                          className="justify-start h-auto p-3"
                          onClick={() => setCompareVersion(version)}
                        >
                          <div className="text-left">
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