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
