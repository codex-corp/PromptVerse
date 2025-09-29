"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if ("serviceWorker" in navigator) {
      const register = async () => {
        try {
          await navigator.serviceWorker.register("/sw.js");
        } catch (error) {
          console.error("Service worker registration failed", error);
        }
      };

      register();
    }
  }, []);

  return null;
}
