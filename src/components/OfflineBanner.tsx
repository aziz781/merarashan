import { useEffect, useState } from "react";
import { WifiOff, AlertTriangle, X } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { subscribeNetworkIssue } from "@/lib/networkStatus";

const DISMISS_KEY = "mr_offline_banner_dismissed";

function readDismissed(): string | null {
  try {
    return localStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
}
function writeDismissed(key: string | null) {
  try {
    if (key === null) localStorage.removeItem(DISMISS_KEY);
    else localStorage.setItem(DISMISS_KEY, key);
  } catch {
    /* ignore */
  }
}

/**
 * Top-of-screen banner for connectivity problems:
 *  - Device offline (navigator.onLine === false)
 *  - Transient network/server errors reported via reportNetworkIssue()
 *  - Brief "Back online" confirmation on recovery
 *
 * Dismissed state persists in localStorage, keyed by the current condition,
 * so it stays hidden until the next connectivity change.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  const [showReconnected, setShowReconnected] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const [issueAt, setIssueAt] = useState<number>(0);
  const [dismissedKey, setDismissedKey] = useState<string | null>(readDismissed);

  // Track offline → online transition for the "Back online" toast.
  useEffect(() => {
    if (!online) {
      setWasOffline(true);
      setShowReconnected(false);
      return;
    }
    if (wasOffline) {
      setShowReconnected(true);
      const t = setTimeout(() => setShowReconnected(false), 2500);
      return () => clearTimeout(t);
    }
  }, [online, wasOffline]);

  // Subscribe to transient network issues from fetch/query errors.
  useEffect(() => {
    return subscribeNetworkIssue((at) => setIssueAt(at));
  }, []);

  // Auto-clear the network-issue banner after 8s of quiet.
  useEffect(() => {
    if (!issueAt) return;
    const t = setTimeout(() => setIssueAt(0), 8000);
    return () => clearTimeout(t);
  }, [issueAt]);

  const hasIssue = online && issueAt > 0;

  // Compute a stable key for the current banner condition. When it changes
  // (i.e. connectivity state changes), the previous dismissal no longer applies.
  const currentKey = !online
    ? "offline"
    : hasIssue
      ? `issue:${issueAt}`
      : showReconnected
        ? "reconnected"
        : null;

  // If condition changed away from what was dismissed, clear the flag.
  useEffect(() => {
    if (dismissedKey && dismissedKey !== currentKey) {
      setDismissedKey(null);
      writeDismissed(null);
    }
  }, [currentKey, dismissedKey]);

  if (!currentKey) return null;
  if (dismissedKey === currentKey) return null;

  let content: React.ReactNode;
  let cls: string;
  if (!online) {
    cls = "bg-amber-500 text-amber-950";
    content = (
      <>
        <WifiOff className="h-4 w-4" aria-hidden="true" />
        <span>You’re offline — showing saved data</span>
      </>
    );
  } else if (hasIssue) {
    cls = "bg-red-600 text-white";
    content = (
      <>
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        <span>Network issue — some data may not load. Retrying…</span>
      </>
    );
  } else {
    cls = "bg-emerald-600 text-white";
    content = <span>Back online — refreshing data</span>;
  }

  const isNativeIOS =
    typeof window !== "undefined" &&
    ((window as unknown as { Capacitor?: { getPlatform?: () => string } })
      .Capacitor?.getPlatform?.() === "ios");

  const onDismiss = () => {
    setDismissedKey(currentKey);
    writeDismissed(currentKey);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={
        "fixed inset-x-0 z-[60] flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium shadow-sm " +
        cls
      }
      style={{
        top: isNativeIOS
          ? "calc(max(env(safe-area-inset-top), 44px) + 1.5rem + 60px)"
          : "calc(env(safe-area-inset-top) + 0.75rem + 60px)",
      }}
    >
      <div className="flex items-center gap-2">{content}</div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded-full hover:bg-black/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-current"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
