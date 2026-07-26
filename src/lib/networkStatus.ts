// Lightweight pub/sub for transient network issues (failed fetch / 5xx / timeout)
// separate from navigator.onLine. Consumers subscribe to show a banner briefly.

type Listener = (at: number) => void;
const listeners = new Set<Listener>();

/** Call when a request fails due to network/server issues. */
export function reportNetworkIssue() {
  const at = Date.now();
  listeners.forEach((l) => {
    try { l(at); } catch { /* ignore */ }
  });
}

/** Call when a request succeeds — clears the banner. */
export function reportNetworkOk() {
  listeners.forEach((l) => {
    try { l(0); } catch { /* ignore */ }
  });
}

export function subscribeNetworkIssue(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Heuristic: does this error look like a network/connectivity problem? */
export function isNetworkishError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof TypeError) return true; // fetch network failure
  const msg = (err as { message?: string })?.message?.toLowerCase() ?? "";
  if (!msg) return false;
  return (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network request failed") ||
    msg.includes("load failed") ||
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("connection")
  );
}
