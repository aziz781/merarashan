import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing, HelpCircle } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import {
  isNativePlatform,
  isIOSNative,
  isAndroidNative,
  getNativeNotificationPermission,
} from "@/lib/nativePush";
import { PUSH_PERMISSION_CHANGED_EVENT } from "@/hooks/use-push-enabled";


type Status = "granted" | "denied" | "prompt" | "prompt-with-rationale" | "unknown";

type Meta = {
  icon: typeof Bell;
  label: string;
  hint: string;
  className: string;
  iconClassName: string;
};

function metaFor(status: Status, os: "iOS" | "Android"): Meta {
  switch (status) {
    case "granted":
      return {
        icon: BellRing,
        label: "Notifications allowed",
        hint: `Delivering push alerts to this device.`,
        className:
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        iconClassName: "text-emerald-600 dark:text-emerald-400",
      };
    case "denied":
      return {
        icon: BellOff,
        label: "Notifications blocked",
        hint: `Open Settings → Mera Rashan → Notifications to allow alerts.`,
        className:
          "border-destructive/30 bg-destructive/10 text-destructive",
        iconClassName: "text-destructive",
      };
    case "prompt":
    case "prompt-with-rationale":
      return {
        icon: Bell,
        label: "Notifications not enabled yet",
        hint: `Hasn't asked yet — tap Enable to allow push alerts.`,
        className:
          "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        iconClassName: "text-amber-600 dark:text-amber-400",
      };
    default:
      return {
        icon: HelpCircle,
        label: "Notification status unknown",
        hint: "We couldn't read the current permission state.",
        className: "border-border bg-muted text-muted-foreground",
        iconClassName: "text-muted-foreground",
      };
  }
}

export function NotificationPermissionBadge({
  compact = false,
  className = "",
}: {
  compact?: boolean;
  className?: string;
}) {
  const [status, setStatus] = useState<Status>("unknown");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isNativePlatform()) return;
    let cancelled = false;
    const refresh = async () => {
      const s = await getNativeNotificationPermission();
      if (!cancelled) {
        setStatus(s as Status);
        setReady(true);
      }
    };
    void refresh();
    const onVis = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", refresh);
    window.addEventListener(PUSH_PERMISSION_CHANGED_EVENT, refresh);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(PUSH_PERMISSION_CHANGED_EVENT, refresh);
    };
  }, []);


  if (!isNativePlatform() || !ready) return null;

  const os: "iOS" | "Android" = isIOSNative()
    ? "iOS"
    : isAndroidNative()
      ? "Android"
      : (Capacitor.getPlatform() as "iOS" | "Android");
  const meta = metaFor(status, os);
  const Icon = meta.icon;

  if (compact) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${meta.className} ${className}`}
        role="status"
        aria-label={`${meta.label}`}
      >
        <Icon className={`h-3.5 w-3.5 shrink-0 ${meta.iconClassName}`} aria-hidden="true" />
        <span className="truncate">{meta.label}</span>
      </div>
    );
  }


  return (
    <div
      className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 text-xs ${meta.className} ${className}`}
      role="status"
      aria-label={`${meta.label}`}
    >
  
      <div className="min-w-0">

        <p className="font-semibold leading-tight">
          {meta.label}
        </p>
        <p className="mt-0.5 leading-snug opacity-90">{meta.hint}</p>
      </div>
    </div>
  );
}
