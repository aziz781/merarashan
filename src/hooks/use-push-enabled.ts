import { useCallback, useEffect, useRef, useState } from "react";
import { App } from "@capacitor/app";
import { getCurrentSubscription, pushSupported } from "@/lib/push";
import {
  isNativePlatform,
  isIOSNative,
  getIOSNotificationPermission,
  getAndroidNotificationPermission,
} from "@/lib/nativePush";

const NATIVE_ENABLED_KEY = "mr_native_push_enabled";

/** Event fired whenever push permission/subscription state may have changed. */
export const PUSH_PERMISSION_CHANGED_EVENT = "mr:push-permission-changed";

/** Broadcast so all listening hooks/components refresh their view of push state. */
export function notifyPushPermissionChanged(): void {
  try {
    window.dispatchEvent(new CustomEvent(PUSH_PERMISSION_CHANGED_EVENT));
  } catch { /* ignore */ }
}


async function computePushEnabled(): Promise<boolean> {
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
}

/**
 * Shared source of truth for whether push notifications are effectively
 * enabled on this device. Refreshes on mount, tab visibility changes and
 * — on native platforms — Capacitor App `resume` events.
 *
 * Returns `null` while the initial check is in-flight so callers can
 * distinguish "unknown" from "known-disabled". `refresh` lets callers
 * invalidate the state after they've toggled the subscription.
 */
export function usePushEnabled(): { enabled: boolean | null; refresh: () => Promise<void> } {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const cancelledRef = useRef(false);

  const refresh = useCallback(async () => {
    const next = await computePushEnabled();
    if (!cancelledRef.current) setEnabled(next);
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    void refresh();

    const onVis = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVis);

    let removeResume: (() => void) | null = null;
    if (isNativePlatform()) {
      const handle = App.addListener("resume", () => { void refresh(); });
      removeResume = () => { void handle.then((h) => h.remove()); };
    }

    return () => {
      cancelledRef.current = true;
      document.removeEventListener("visibilitychange", onVis);
      removeResume?.();
    };
  }, [refresh]);

  return { enabled, refresh };
}
