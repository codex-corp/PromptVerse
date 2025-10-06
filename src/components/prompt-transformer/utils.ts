"use client";

import { toast } from "sonner";

export const extractModesFromPrompt = (prompt: string): string[] => {
    if (!prompt) return [];
    const match = prompt.match(/\/[A-Z][A-Z0-9 /:+-]*/g);
    if (!match) return [];
    return Array.from(new Set(match.map((item) => item.trim())));
};

export const toRTF = (plainText: string) => {
    const escaped = plainText
        .replace(/\\/g, "\\\\")
        .replace(/{/g, "\\{")
        .replace(/}/g, "\\}")
        .replace(/\r?\n/g, "\\par\n");
    return `{\\rtf1\\ansi\n${escaped}\n}`;
};

export const getFileExtension = (fileName: string) => {
    const dotIndex = fileName.lastIndexOf(".");
    return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : "";
};

export const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, exponent);
    return `${value.toFixed(value < 10 && exponent > 0 ? 1 : 0)}${units[exponent]}`;
};

const escapeHtml = (content: string) =>
    content
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

const SCRIPT_TAG_PATTERN = /<script[\s\S]*?>[\s\S]*?<\/script>/gi;

export const sanitizeFileContent = (content: string) => {
    const withoutScripts = content.replace(SCRIPT_TAG_PATTERN, "");
    return escapeHtml(withoutScripts);
};

export const buildPreviewFromContent = (content: string) => {
    if (content.length <= 100) {
        return content;
    }
    return `${content.slice(0, 100)}…`;
};

const LARGE_FILE_THRESHOLD = 1 * 1024 * 1024;

export const readFileContentWithSanitization = async (file: File) => {
    const shouldDebounce = file.size > LARGE_FILE_THRESHOLD;

    if (shouldDebounce) {
        await new Promise((resolve) => setTimeout(resolve, 200));
    }

    const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === "string") {
                resolve(reader.result);
            } else {
                reject(new Error("Unable to read file content"));
            }
        };
        reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
        reader.readAsText(file);
    });

    const isBinary = /\u0000/.test(text) || (text.match(/\uFFFD/g) || []).length > Math.max(16, text.length / 200);

    if (isBinary) {
        toast.warning(`Skipping ${file.name} because it does not appear to be UTF-8 text.`);
        return {
            sanitized: "",
            preview: "Preview unavailable for binary file.",
            isBinary: true,
        };
    }

    const sanitized = sanitizeFileContent(text);
    return {
        sanitized,
        preview: buildPreviewFromContent(sanitized),
        isBinary: false,
    };
};
