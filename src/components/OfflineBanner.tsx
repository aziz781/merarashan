import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";

/**
 * Shows a compact banner at the top of the screen when the device goes
 * offline. The app keeps working from the React Query / service-worker
 * cache; this just makes the state visible to the user.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  const [showReconnected, setShowReconnected] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

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

  if (online && !showReconnected) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={
        "fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium shadow-sm " +
        (online
          ? "bg-emerald-600 text-white"
          : "bg-amber-500 text-amber-950")
      }
    >
      {online ? (
        <span>Back online — refreshing data</span>
      ) : (
        <>
          <WifiOff className="h-4 w-4" aria-hidden="true" />
          <span>You’re offline — showing saved data</span>
        </>
      )}
    </div>
  );
}
