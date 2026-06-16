/**
 * Thin wrapper around Storage that swallows access errors
 * (e.g. private-browsing, disabled cookies, Safari quota).
 */
function wrap(getStore: () => Storage | undefined) {
  return {
    get(key: string): string | null {
      try {
        return getStore()?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    set(key: string, value: string): void {
      try {
        getStore()?.setItem(key, value);
      } catch {
        /* ignore */
      }
    },
    remove(key: string): void {
      try {
        getStore()?.removeItem(key);
      } catch {
        /* ignore */
      }
    },
    getJSON<T>(key: string): T | null {
      const raw = this.get(key);
      if (raw == null) return null;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    },
    setJSON(key: string, value: unknown): void {
      try {
        this.set(key, JSON.stringify(value));
      } catch {
        /* ignore */
      }
    },
  };
}

export const safeSession = wrap(() =>
  typeof window === "undefined" ? undefined : window.sessionStorage,
);
export const safeLocal = wrap(() =>
  typeof window === "undefined" ? undefined : window.localStorage,
);
