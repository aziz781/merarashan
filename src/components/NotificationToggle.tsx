import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { disablePush, enablePush, getCurrentSubscription, pushSupported } from "@/lib/push";

export function NotificationToggle({ mobile }: { mobile: string }) {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSupported(pushSupported());
    if (!pushSupported()) return;
    getCurrentSubscription()
      .then((s) => setEnabled(!!s && Notification.permission === "granted"))
      .catch(() => setEnabled(false));
  }, []);

  if (!supported) return null;

  const onToggle = async () => {
    setBusy(true);
    try {
      if (enabled) {
        await disablePush();
        setEnabled(false);
        toast.success("Notifications disabled");
      } else {
        await enablePush(mobile);
        setEnabled(true);
        toast.success("Notifications enabled");
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

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
        <Button size="sm" variant={enabled ? "outline" : "default"} disabled={busy} onClick={onToggle}>
          {busy ? "…" : enabled ? "Disable" : "Enable"}
        </Button>
      </div>
    </Card>
  );
}
