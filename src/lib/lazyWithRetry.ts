import { lazy, type ComponentType } from "react";

/**
 * Wraps React.lazy so that a failed dynamic import (typically caused by a
 * stale chunk hash after a new deploy) triggers a one-time full page reload
 * instead of surfacing as a blank screen.
 */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy<T>(async () => {
    const STORAGE_KEY = "mr_chunk_reload";
    try {
      const mod = await factory();
      sessionStorage.removeItem(STORAGE_KEY);
      return mod;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isChunkError =
        /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|error loading dynamically imported module/i.test(
          message,
        );
      if (isChunkError && typeof window !== "undefined") {
        const alreadyReloaded = sessionStorage.getItem(STORAGE_KEY);
        if (!alreadyReloaded) {
          sessionStorage.setItem(STORAGE_KEY, "1");
          window.location.reload();
          // Return a never-resolving promise so Suspense waits for the reload.
          return new Promise(() => {}) as Promise<{ default: T }>;
        }
      }
      throw err;
    }
  });
}
