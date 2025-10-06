import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { getRepoMetadata } from "@/lib/repo-metadata";
import { Github } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "PromptVerse | Open-Source Prompt Management",
  description: "PromptVerse is the open-source hub for discovering, curating, and transforming AI prompts across your favorite models.",
  applicationName: "PromptVerse",
  keywords: [
    "prompt management",
    "AI prompts",
    "PromptVerse",
    "Next.js",
    "open source",
    "prompt library",
  ],
  authors: [{ name: "PromptVerse Community" }],
  openGraph: {
    title: "PromptVerse",
    description: "Organize and share AI prompts with the open-source PromptVerse platform.",
    url: "https://promptverse.app",
    siteName: "PromptVerse",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PromptVerse",
    description: "Open-source prompt management for creators and teams.",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/logo.svg", type: "image/svg+xml" }],
    shortcut: ["/logo.svg"],
    apple: [{ url: "/logo.svg" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { lastUpdatedLabel, currentYear } = await getRepoMetadata();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased bg-background text-foreground dark">
        <div className="min-h-screen pb-20">{children}</div>
        <footer
          role="contentinfo"
          aria-label="PromptVerse site footer"
          className="fixed inset-x-0 bottom-0 z-50 bg-transparent border-t px-6 text-xs font-sans text-white"
        >
          <div className="mx-auto flex min-h-[16px] max-w-7xl flex-col items-center justify-center gap-2 py-3 md:flex-row md:flex-nowrap">
            <span className="text-center md:text-left">
              © {currentYear} PromptVerse. All rights reserved.
            </span>
            <span className="text-center md:text-left">{lastUpdatedLabel}</span>
            <Link
              href="https://github.com/codex-corp/PromptVerse"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-center transition-colors hover:text-[#007bff]"
            >
              <Github className="h-4 w-4" aria-hidden="true" />
              <span>GitHub Repo</span>
            </Link>
            <div className="flex flex-col items-center gap-1 text-center md:flex-row md:items-center md:gap-2">
              <span>
                Made with <span role="img" aria-label="love">❤️</span> by{" "}
                <Link
                  href="https://github.com/codex-corp/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-[#007bff]"
                >
                  Hany alsamman
                </Link>
              </span>
              <Link
                href="https://www.linkedin.com/in/hanyalsamman/"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-[#007bff]"
              >
                in/Hanyalsamman
              </Link>
            </div>
          </div>
        </footer>
        <Toaster />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
