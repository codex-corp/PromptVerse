"use client";

import { toRTF } from "../utils";
import type { TransformFormat } from "../core";

function extractJsonContent(text: string): string {
    try {
        const parsed = JSON.parse(text);
        return typeof parsed.content === "string" ? parsed.content : text;
    } catch {
        return text;
    }
}

export function deriveClipboardContent(text: string, format: TransformFormat): string {
    if (format === "json") {
        return extractJsonContent(text);
    }

    const jsonBlock = text.match(/```json\n([\s\S]*?)\n```/);
    if (jsonBlock) {
        return extractJsonContent(jsonBlock[1]);
    }

    return text;
}

export async function writePlainClipboard(content: string): Promise<void> {
    await navigator.clipboard.writeText(content);
}

export async function writeRichClipboard(text: string): Promise<boolean> {
    const rtfContent = toRTF(text);

    if (typeof window === "undefined") {
        await navigator.clipboard.writeText(text);
        return false;
    }

    if (!("ClipboardItem" in window) || !navigator.clipboard || typeof navigator.clipboard.write !== "function") {
        await navigator.clipboard.writeText(text);
        return false;
    }

    try {
        const ClipboardItemConstructor = (window as typeof window & { ClipboardItem: typeof ClipboardItem }).ClipboardItem;
        const clipboardItem = new ClipboardItemConstructor({
            "text/rtf": new Blob([rtfContent], { type: "text/rtf" }),
            "text/plain": new Blob([text], { type: "text/plain" }),
        });
        await navigator.clipboard.write([clipboardItem]);
        return true;
    } catch {
        await navigator.clipboard.writeText(text);
        return false;
    }
}
