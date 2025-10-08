import type { UploadedFileState } from "./file-attachments";

export const ACCEPTED_EXTENSIONS = [
    ".py",
    ".php",
    ".js",
    ".ts",
    ".html",
    ".css",
    ".md",
    ".txt",
    ".json",
    ".csv",
    ".xml",
    ".yml",
    ".yaml",
    ".ini",
    ".conf",
    ".sql",
    ".bash",
    ".sh",
    ".bat",
    ".ps1",
    ".env",
    ".log",
    ".pdf",
    ".docx",
    ".xlsx",
    ".jpg",
    ".jpeg",
];

export const MAX_FILES = 10;
export const MAX_FILE_SIZE = 5 * 1024 * 1024;
export const MAX_TOTAL_IMAGE_BYTES = 1024 * 1024;
export const MAX_CONTEXT_SIZE = 100 * 1024;
export const MAX_INPUT_LENGTH = 8000;

export function isSupportedExtension(name: string): boolean {
    return ACCEPTED_EXTENSIONS.some((extension) => name.toLowerCase().endsWith(extension));
}

export function isWithinFileSizeLimit(size: number): boolean {
    return size <= MAX_FILE_SIZE;
}

export function hasRemainingFileSlots(currentFiles: number, incomingFiles: number): boolean {
    return currentFiles + incomingFiles <= MAX_FILES;
}

export function enforceContextLimit(files: UploadedFileState[]) {
    const sortedByAdded = [...files].sort((a, b) => a.addedAt - b.addedAt);
    let total = sortedByAdded.reduce((sum, file) => sum + (file.content?.length ?? 0), 0);
    const removalSet = new Set<string>();

    let imageBytes = sortedByAdded.reduce((sum, file) => {
        const extension = file.name.split(".").pop()?.toLowerCase();
        if (extension && ["jpg", "jpeg", "png", "gif", "webp"].includes(extension)) {
            return sum + (file.size ?? 0);
        }
        return sum;
    }, 0);

    while (total > MAX_CONTEXT_SIZE && sortedByAdded.length) {
        const oldest = sortedByAdded.shift();
        if (!oldest) {
            break;
        }
        removalSet.add(oldest.id);
        total -= oldest.content?.length ?? 0;
        const extension = oldest.name.split(".").pop()?.toLowerCase();
        if (extension && ["jpg", "jpeg"].includes(extension)) {
            imageBytes -= oldest.size ?? 0;
        }
    }

    while (imageBytes > MAX_TOTAL_IMAGE_BYTES && sortedByAdded.length) {
        const oldest = sortedByAdded.shift();
        if (!oldest) {
            break;
        }
        removalSet.add(oldest.id);
        const extension = oldest.name.split(".").pop()?.toLowerCase();
        if (extension && ["jpg", "jpeg"].includes(extension)) {
            imageBytes -= oldest.size ?? 0;
        }
    }

    const nextFiles = files.filter((file) => !removalSet.has(file.id));
    const removedFiles = files.filter((file) => removalSet.has(file.id));

    return { nextFiles, removedFiles };
}
