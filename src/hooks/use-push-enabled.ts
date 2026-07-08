import { useEffect, useState } from "react";
import { App } from "@capacitor/app";
import { getCurrentSubscription, pushSupported } from "@/lib/push";
import {
  isNativePlatform,
  isIOSNative,
  getIOSNotificationPermission,
  getAndroidNotificationPermission,
} from "@/lib/nativePush";

const NATIVE_ENABLED_KEY = "mr_native_push_enabled";

/**
 * Shared source of truth for whether push notifications are effectively
 * enabled on this device. Refreshes on mount, tab visibility changes and
 * — on native platforms — Capacitor App `resume` events.
 *
 * Returns `null` while the initial check is in-flight so callers can
 * distinguish "unknown" from "known-disabled".
 */
export function usePushEnabled(): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    const compute = async (): Promise<boolean> => {
      try {
        if (isNativePlatform()) {
          const status = isIOSNative()
            ? await getIOSNotificationPermission()
            : await getAndroidNotificationPermission();
          let optedIn = false;
          try { optedIn = localStorage.getItem(NATIVE_ENABLED_KEY) === "1"; } catch { /* ignore */ }
          return status === "granted" && optedIn;
        }
        if (!pushSupported()) return false;
        const sub = await getCurrentSubscription();
        return !!sub && Notification.permission === "granted";
      } catch {
        return false;
      }
    };

    const refresh = async () => {
      const next = await compute();
      if (!cancelled) setEnabled(next);
    };

    void refresh();

    const onVis = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVis);

    let removeResume: (() => void) | null = null;
    if (isNativePlatform()) {
      const handle = App.addListener("resume", refresh);
      removeResume = () => { void handle.then((h) => h.remove()); };
    }

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      removeResume?.();
    };
  }, []);

  return enabled;
}
