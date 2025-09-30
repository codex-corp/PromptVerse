"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      process.env.NODE_ENV === "production"
    ) {
      console.log("Registering service worker...");
      const register = async () => {
        try {
          await navigator.serviceWorker.register("/sw.js");
        } catch (error) {
          console.error("Service worker registration failed", error);
        }
      };

      register();
    } else {
      console.log("Skipping service worker registration in development.");
    }
  }, []);

  return null;
}
