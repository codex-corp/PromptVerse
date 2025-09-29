"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

interface PWAInstallButtonProps {
  className?: string;
}

export function PWAInstallButton({ className }: PWAInstallButtonProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [fallbackMessageVisible, setFallbackMessageVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const isStandalone = window.matchMedia?.("(display-mode: standalone)").matches || (window.navigator as any).standalone;
    if (isStandalone) {
      setIsInstalled(true);
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      setFallbackMessageVisible(true);
      return;
    }

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  return (
    <div className={cn("flex flex-col", className)}>
      <Button variant="outline" size="sm" onClick={handleInstallClick} disabled={isInstalled}>
        <Download className="mr-2 h-4 w-4" />
        {isInstalled ? "Installed" : "Install App"}
      </Button>
      {fallbackMessageVisible && !deferredPrompt && !isInstalled ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Use your browser’s menu to install PromptVerse as an app.
        </p>
      ) : null}
    </div>
  );
}
