"use client";

import type { HTMLAttributes, ReactNode } from "react";
import type { Components } from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";

export type MarkdownCodeProps = HTMLAttributes<HTMLElement> & {
    inline?: boolean;
    className?: string;
    children?: ReactNode;
    node?: unknown;
};

export function createMarkdownComponents(): Components {
    return {
        code({ inline, className, children, ...props }: MarkdownCodeProps) {
            const match = /language-(\w+)/.exec(className || "");
            if (!inline && match) {
                return (
                    <SyntaxHighlighter style={atomDark} language={match[1]} PreTag="div" {...props}>
                        {String(children).replace(/\n$/, "")}
                    </SyntaxHighlighter>
                );
            }

            return (
                <code className={className} {...props}>
                    {children}
                </code>
            );
        },
    };
}
