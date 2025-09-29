import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ServiceWorkerRegister } from "@/components/service-worker-register";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased bg-background text-foreground dark">
        {children}
        <Toaster />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
