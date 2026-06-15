import { ShieldCheck, Bell, BellOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { subscribeNotifications, unreadCount } from "@/lib/notificationsStore";
import { getCurrentSubscription, pushSupported } from "@/lib/push";
import { isNativePlatform } from "@/lib/nativePush";

declare const __BUILD_VERSION__: string;

const NATIVE_ENABLED_KEY = "mr_native_push_enabled";

export function PageFooter() {
  const navigate = useNavigate();
  const [count, setCount] = useState<number>(() => unreadCount());
  const [pushEnabled, setPushEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    const unsub = subscribeNotifications(() => setCount(unreadCount()));
    (async () => {
      try {
        if (isNativePlatform()) {
          setPushEnabled(localStorage.getItem(NATIVE_ENABLED_KEY) === "1");
          return;
        }
        if (!pushSupported()) {
          setPushEnabled(false);
          return;
        }
        const sub = await getCurrentSubscription();
        setPushEnabled(!!sub && Notification.permission === "granted");
      } catch {
        setPushEnabled(false);
      }
    })();
    return () => unsub();
  }, []);

  return (
    <div className="flex flex-col items-center text-center pt-6 pb-4 mt-4">
      <button
        type="button"
        onClick={() => navigate("/notifications")}
        aria-label="Notifications"
        className="relative mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md hover:opacity-90 transition-opacity"
      >
        {pushEnabled === false ? <BellOff className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>
      <ShieldCheck className="w-5 h-5 text-muted-foreground mb-1" />
      <p className="text-sm font-semibold text-muted-foreground">MeraRashan.pk</p>
      <p className="text-xs text-muted-foreground">Safe and transparent service in every step of the way.</p>
      <p className="text-[10px] text-muted-foreground/60 mt-2">Build {__BUILD_VERSION__}</p>
    </div>
  );
}
