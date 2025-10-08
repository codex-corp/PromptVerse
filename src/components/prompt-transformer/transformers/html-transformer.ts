"use client";

export function downloadContent({ content, filename, mimeType = "text/plain" }: {
    content: string;
    filename: string;
    mimeType?: string;
}): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    try {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
    } finally {
        URL.revokeObjectURL(url);
    }
}
