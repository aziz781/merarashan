import { useEffect, useState } from "react";
import { Bell, BellOff, CheckCircle2, RefreshCw, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  disablePush,
  enablePush,
  getCurrentSubscription,
  pushSupported,
  syncPushSubscription,
} from "@/lib/push";
import {
  disableNativePush,
  enableNativePush,
  isNativePlatform,
  isIOSNative,
  isAndroidNative,
  getIOSNotificationPermission,
  getAndroidNotificationPermission,
} from "@/lib/nativePush";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type SyncStatus =
  | "checking"
  | "matched"
  | "resubscribed"
  | "mismatch-failed"
  | "not-enabled"
  | "unsupported";

const NATIVE_ENABLED_KEY = "mr_native_push_enabled";

export function NotificationToggle({ mobile }: { mobile: string }) {
  const native = isNativePlatform();
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("checking");
  const [rationaleOpen, setRationaleOpen] = useState(false);

  useEffect(() => {
    // --- Native (Capacitor/FCM) branch ---
    if (native) {
      setSupported(true);
      let cancelled = false;
      const refresh = async () => {
        const status = isIOSNative()
          ? await getIOSNotificationPermission()
          : await getAndroidNotificationPermission();
        if (cancelled) return;
        const granted = status === "granted";
        setEnabled(granted);
        setSyncStatus(granted ? "matched" : "not-enabled");
        if (granted) {
          try { localStorage.setItem(NATIVE_ENABLED_KEY, "1"); } catch { /* ignore */ }
        } else {
          try { localStorage.removeItem(NATIVE_ENABLED_KEY); } catch { /* ignore */ }
        }
      };
      void refresh();
      const onVis = () => {
        if (document.visibilityState === "visible") void refresh();
      };
      document.addEventListener("visibilitychange", onVis);
      window.addEventListener("focus", refresh);
      return () => {
        cancelled = true;
        document.removeEventListener("visibilitychange", onVis);
        window.removeEventListener("focus", refresh);
      };
    }

    // --- Web push branch ---
    if (!pushSupported()) {
      setSupported(false);
      setSyncStatus("unsupported");
      return;
    }
    setSupported(true);

    let cancelled = false;
    (async () => {
      try {
        const result = await syncPushSubscription(mobile);
        if (cancelled) return;
        if (result === "resubscribed") {
          setEnabled(true);
          setSyncStatus("resubscribed");
          toast.success("Notifications updated", {
            description: "Re-subscribed this device to the latest push key.",
          });
          return;
        }
        if (result === "unchanged") {
          setEnabled(true);
          setSyncStatus("matched");
          return;
        }
        const s = await getCurrentSubscription();
        if (cancelled) return;
        setEnabled(!!s && Notification.permission === "granted");
        setSyncStatus("not-enabled");
      } catch (e: unknown) {
        if (cancelled) return;
        setSyncStatus("mismatch-failed");
        toast.error("Couldn't refresh push subscription", {
          description:
            e instanceof Error ? e.message : "Please toggle notifications off and back on.",
        });
        try {
          const s = await getCurrentSubscription();
          if (!cancelled) setEnabled(!!s && Notification.permission === "granted");
        } catch {
          if (!cancelled) setEnabled(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mobile, native]);

  if (!supported) {
    const inIframe = (() => {
      try { return window.self !== window.top; } catch { return true; }
    })();
    return (
      <Card className="p-4 bg-card/80 backdrop-blur shadow-[var(--shadow-soft)] border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
            <BellOff className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Push Notifications</p>
            <p className="text-xs text-muted-foreground">
              {inIframe
                ? "Open the app in your browser or install it to enable notifications."
                : "Not supported on this device or browser."}
            </p>
          </div>
          <Button size="sm" variant="outline" disabled>
            Enable
          </Button>
        </div>
      </Card>
    );
  }

  const doEnableNative = async () => {
    setBusy(true);
    try {
      await enableNativePush(mobile);
      localStorage.setItem(NATIVE_ENABLED_KEY, "1");
      setEnabled(true);
      setSyncStatus("matched");
      toast.success("Notifications enabled");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      if (/denied/i.test(msg)) {
        toast.error("Notifications are blocked", {
          description: isIOSNative()
            ? "Open iOS Settings → MeraRashan → Notifications to allow alerts."
            : "Open Android Settings → Apps → MeraRashan → Notifications to allow alerts.",
        });
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const onToggle = async () => {
    if (native) {
      if (enabled) {
        setBusy(true);
        try {
          await disableNativePush();
          localStorage.removeItem(NATIVE_ENABLED_KEY);
          setEnabled(false);
          setSyncStatus("not-enabled");
          toast.success("Notifications disabled");
        } catch (e: unknown) {
          toast.error(e instanceof Error ? e.message : "Something went wrong");
        } finally {
          setBusy(false);
        }
        return;
      }
      // iOS / Android: show rationale the first time (status === prompt).
      if (isIOSNative()) {
        const status = await getIOSNotificationPermission();
        if (status === "denied") {
          toast.error("Notifications are blocked", {
            description: "Open iOS Settings → MeraRashan → Notifications to allow alerts.",
          });
          return;
        }
        if (status === "prompt" || status === "prompt-with-rationale") {
          setRationaleOpen(true);
          return;
        }
      } else if (isAndroidNative()) {
        const status = await getAndroidNotificationPermission();
        if (status === "denied") {
          toast.error("Notifications are blocked", {
            description: "Open Android Settings → Apps → MeraRashan → Notifications to allow alerts.",
          });
          return;
        }
        if (status === "prompt" || status === "prompt-with-rationale") {
          setRationaleOpen(true);
          return;
        }
      }
      await doEnableNative();
      return;
    }

    setBusy(true);
    try {
      if (enabled) {
        await disablePush();
        setEnabled(false);
        setSyncStatus("not-enabled");
        toast.success("Notifications disabled");
      } else {
        await enablePush(mobile);
        setEnabled(true);
        setSyncStatus("matched");
        toast.success("Notifications enabled");
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const statusMeta: Record<
    SyncStatus,
    { icon: typeof CheckCircle2; text: string; className: string } | null
  > = {
    checking: {
      icon: RefreshCw,
      text: "Checking subscription…",
      className: "text-muted-foreground",
    },
    matched: {
      icon: CheckCircle2,
      text: native ? "Device registered for push" : "Subscription up to date",
      className: "text-emerald-600 dark:text-emerald-400",
    },
    resubscribed: {
      icon: RefreshCw,
      text: "Re-subscribed to the latest push key",
      className: "text-primary",
    },
    "mismatch-failed": {
      icon: AlertTriangle,
      text: "Push key changed — tap Disable then Enable to fix",
      className: "text-destructive",
    },
    "not-enabled": null,
    unsupported: null,
  };

  const status = statusMeta[syncStatus];

  return (
    <Card className="p-4 bg-card/80 backdrop-blur shadow-[var(--shadow-soft)] border-border/50">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          {enabled ? (
            <Bell className="w-5 h-5 text-primary" />
          ) : (
            <BellOff className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Push Notifications</p>
          <p className="text-xs text-muted-foreground">
            {enabled ? "You'll receive updates on this device" : "Get alerts about your rashans"}
          </p>
        </div>
        <Button
          size="sm"
          variant={enabled ? "outline" : "default"}
          disabled={busy}
          onClick={onToggle}
        >
          {busy ? "…" : enabled ? "Disable" : "Enable"}
        </Button>
      </div>

      {status && (
        <div className={`mt-3 flex items-center gap-1.5 text-xs ${status.className}`}>
          <status.icon
            className={`w-3.5 h-3.5 shrink-0 ${syncStatus === "checking" ? "animate-spin" : ""}`}
          />
          <span className="truncate">{status.text}</span>
        </div>
      )}

      <AlertDialog open={rationaleOpen} onOpenChange={setRationaleOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Allow notifications?</AlertDialogTitle>
            <AlertDialogDescription>
              MeraRashan will send you alerts when your monthly rashan is issued,
              when a new statement is available, and for important account updates.
              You can change this any time in your device Settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Not now</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={async (e) => {
                e.preventDefault();
                setRationaleOpen(false);
                await doEnableNative();
              }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
