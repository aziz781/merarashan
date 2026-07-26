import { useEffect, useState } from "react";
import { WifiOff, AlertTriangle } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { subscribeNetworkIssue } from "@/lib/networkStatus";

/**
 * Top-of-screen banner for connectivity problems:
 *  - Device offline (navigator.onLine === false)
 *  - Transient network/server errors reported via reportNetworkIssue()
 *  - Brief "Back online" confirmation on recovery
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  const [showReconnected, setShowReconnected] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const [issueAt, setIssueAt] = useState<number>(0);

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

  if (online && !showReconnected && !hasIssue) return null;

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

  return (
    <div
      role="status"
      aria-live="polite"
      className={
        "fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium shadow-sm " +
        cls
      }
    >
      {content}
    </div>
  );
}
