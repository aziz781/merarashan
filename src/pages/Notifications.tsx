import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, BellOff, Trash2, CheckCheck, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import appLogo from "@/assets/mera-rashan-logo.png";
import { NotificationToggle } from "@/components/NotificationToggle";
import { getCurrentSubscription, pushSupported } from "@/lib/push";
import { isNativePlatform } from "@/lib/nativePush";
import {
  clearAll,
  getNotifications,
  markAllRead,
  markRead,
  toggleRead,
  removeNotification,
  subscribeNotifications,
  syncNotificationInbox,
  type StoredNotification,
} from "@/lib/notificationsStore";
import { SwipeableNotification } from "@/components/SwipeableNotification";
import { openAppLink } from "@/lib/openAppLink";

function timeAgo(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

const NATIVE_ENABLED_KEY = "mr_native_push_enabled";
const MOBILE_KEY = "mr_mobile";

export default function Notifications() {
  const navigate = useNavigate();
  const [items, setItems] = useState<StoredNotification[]>(() => getNotifications());
  const [pushEnabled, setPushEnabled] = useState<boolean | null>(null);
  const [mobile, setMobile] = useState<string>("");
  const [unreadOnly, setUnreadOnly] = useState<boolean>(false);

  useEffect(() => {
    setMobile(localStorage.getItem(MOBILE_KEY) || "");
    const unsub = subscribeNotifications(() => setItems(getNotifications()));
    void syncNotificationInbox().finally(() => {
      setItems(getNotifications());
    });
    setItems(getNotifications());

    // Determine push enabled state
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

    const onVis = () => {
      if (document.visibilityState === "visible") {
        (async () => {
          try {
            if (isNativePlatform()) {
              setPushEnabled(localStorage.getItem(NATIVE_ENABLED_KEY) === "1");
              return;
            }
            if (!pushSupported()) return;
            const sub = await getCurrentSubscription();
            setPushEnabled(!!sub && Notification.permission === "granted");
          } catch { /* ignore */ }
        })();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      unsub();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const openNotification = (n: StoredNotification) => {
    if (!n.read) markRead(n.id);
    const url = n.url;
    openAppLink(url, navigate);
  };



  return (
    <div className="min-h-screen bg-background">
      <header
        className="px-5 pt-10 pb-6 text-primary-foreground"
        style={{ background: "var(--gradient-primary)" }}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm ring-1 ring-white/25 hover:bg-white/25 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold leading-tight flex items-center gap-2">
              Notifications
              {pushEnabled === false && (
                <span className="relative inline-flex" aria-label="Push notifications disabled" title="Push notifications disabled">
                  <BellOff className="h-4 w-4 opacity-90" />
                </span>
              )}
            </h1>
            <p className="text-xs opacity-80">{items.length} total · {items.filter((n) => !n.read).length} unread</p>
          </div>
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => setUnreadOnly((v) => !v)}
              aria-pressed={unreadOnly}
              aria-label={unreadOnly ? "Showing unread only" : "Show unread only"}
              title={unreadOnly ? "Showing unread only" : "Show unread only"}
              className="flex h-10 items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm ring-1 ring-white/25 hover:bg-white/25 transition-colors px-3 text-xs font-medium"
            >
              <Filter className="h-4 w-4" />
              {unreadOnly ? "Unread" : "All"}
            </button>
          )}
        </div>

      </header>

      <div className="p-4 space-y-3 max-w-2xl mx-auto">
        {pushEnabled === false && mobile && (
          <NotificationToggle mobile={mobile} />
        )}
        {(() => {

          const visible = items.filter((n) => (unreadOnly ? !n.read : true));
          return items.length === 0 ? (
          <Card className="p-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Bell className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">No notifications yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              You'll see push notifications you receive here.
            </p>
          </Card>
        ) : visible.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-sm text-muted-foreground">No unread notifications</p>
          </Card>
        ) : (
          visible.map((n) => {
            const t = n.title?.trim().toLowerCase();
            const highlight =
              t === "payment overdue"
                ? "bg-red-100 border-red-300 dark:bg-red-500/15 dark:border-red-500/40"
                : t === "payment due"
                ? "bg-yellow-100 border-yellow-300 dark:bg-yellow-500/15 dark:border-yellow-500/40"
                : t === "payment received" || t === "monthly statement available"
                ? "bg-green-100 border-green-300 dark:bg-green-500/15 dark:border-green-500/40"
                : t === "rashan code issued"
                ? "bg-purple-100 border-purple-300 dark:bg-purple-500/15 dark:border-purple-500/40"
                : "";
            return (
            <SwipeableNotification
              key={n.id}
              onDelete={() => removeNotification(n.id)}
              onMarkRead={() => toggleRead(n.id)}
              onTap={() => openNotification(n)}
            >
            <Card
              className={`p-4 ${!n.read && !highlight ? "ring-1 ring-primary/50 bg-primary/5 border-l-4 border-l-primary" : ""} ${!n.read && highlight ? "ring-1 ring-primary/50 border-l-4 border-l-primary" : ""} ${highlight} ${n.read ? "opacity-80" : ""} cursor-pointer hover:bg-accent/40 transition-colors`}
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                  <img src={appLogo} alt="Mera Rashan" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {n.title}
                    </p>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {timeAgo(n.receivedAt)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap break-words">
                    {n.body || <span className="italic opacity-60">No message body</span>}
                  </p>
                  {(n.month != null || n.year != null) && (
                    <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {n.month != null
                        ? new Date(2000, Math.max(0, Math.min(11, Number(n.month) - 1)), 1).toLocaleString(undefined, { month: "long" })
                        : ""}
                      {n.month != null && n.year != null ? " " : ""}
                      {n.year != null ? String(n.year) : ""}
                    </p>
                  )}
                </div>
              </div>


            </Card>
            </SwipeableNotification>
            );
          })
        );
        })()}


      </div>
    </div>
  );
}
