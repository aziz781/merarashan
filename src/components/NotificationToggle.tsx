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

type SyncStatus =
  | "checking"
  | "matched"
  | "resubscribed"
  | "mismatch-failed"
  | "not-enabled"
  | "unsupported";

export function NotificationToggle({ mobile }: { mobile: string }) {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("checking");

  useEffect(() => {
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
        // result === "skipped" — permission not granted or no mobile yet.
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
  }, [mobile]);

  if (!supported) return null;

  const onToggle = async () => {
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
      text: "Subscription up to date",
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
    </Card>
  );
}
