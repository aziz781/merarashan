import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowUp, Bell, BellOff, Home, Loader2, RefreshCw, Trash2, CheckCheck, Filter } from "lucide-react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import appLogo from "@/assets/mera-rashan-logo.webp";
import { NotificationToggle } from "@/components/NotificationToggle";
import { usePushEnabled } from "@/hooks/use-push-enabled";
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
import { PageHeader } from "@/components/PageHeader";

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

const MOBILE_KEY = "mr_mobile";

const PULL_THRESHOLD = 70;
const PULL_MAX = 120;

export default function Notifications() {
  const navigate = useNavigate();
  const [items, setItems] = useState<StoredNotification[]>(() => getNotifications());
  const { enabled: pushEnabled } = usePushEnabled();
  const [mobile, setMobile] = useState<string>("");
  const [unreadOnly, setUnreadOnly] = useState<boolean>(false);
  const [showBackToTop, setShowBackToTop] = useState<boolean>(false);
  const [deleteAllOpen, setDeleteAllOpen] = useState<boolean>(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullStartY = useRef<number | null>(null);
  const pulling = useRef(false);

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const resync = useCallback(async (opts?: { notifyOnError?: boolean }) => {
    const result = await syncNotificationInbox();
    setItems(getNotifications());
    if (!result.ok && opts?.notifyOnError) {
      toast.error("Couldn't refresh notifications", {
        description: result.error || "Please check your connection and try again.",
      });
    }
    return result;
  }, []);

  useEffect(() => {
    setMobile(localStorage.getItem(MOBILE_KEY) || "");
    const unsub = subscribeNotifications(() => setItems(getNotifications()));
    void resync();
    setItems(getNotifications());
    const onVisibility = () => {
      if (document.visibilityState === "visible") void resync();
    };
    const onFocus = () => void resync();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      unsub();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [resync]);

  const triggerRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await resync({ notifyOnError: true });
    } finally {
      setRefreshing(false);
      setPullDistance(0);
    }
  }, [refreshing, resync]);


  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 0 || refreshing) return;
      pullStartY.current = e.touches[0].clientY;
      pulling.current = true;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!pulling.current || pullStartY.current === null) return;
      const delta = e.touches[0].clientY - pullStartY.current;
      if (delta <= 0) {
        setPullDistance(0);
        return;
      }
      // dampen the pull
      const damped = Math.min(PULL_MAX, delta * 0.5);
      setPullDistance(damped);
      if (damped > 8 && e.cancelable) e.preventDefault();
    };
    const onTouchEnd = () => {
      if (!pulling.current) return;
      pulling.current = false;
      pullStartY.current = null;
      if (pullDistance >= PULL_THRESHOLD) {
        void triggerRefresh();
      } else {
        setPullDistance(0);
      }
    };
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [pullDistance, refreshing, triggerRefresh]);

  const indicatorOffset = refreshing ? 56 : pullDistance;
  const reached = pullDistance >= PULL_THRESHOLD;




  const openNotification = (n: StoredNotification) => {
    if (!n.read) markRead(n.id);
    const url = n.url;
    openAppLink(url, navigate);
  };

  const visible = items.filter((n) => (unreadOnly ? !n.read : true));

  return (
    <div className="min-h-screen bg-background" style={{ transform: `translateY(${indicatorOffset}px)`, transition: pulling.current ? "none" : "transform 200ms ease" }}>
      <div
        className="pointer-events-none fixed left-1/2 -translate-x-1/2 z-40 flex items-center justify-center h-10 w-10 rounded-full bg-primary text-primary-foreground shadow-lg"
        style={{
          top: 8,
          opacity: indicatorOffset > 0 ? Math.min(1, indicatorOffset / PULL_THRESHOLD) : 0,
          transform: `translateX(-50%) translateY(${indicatorOffset - 48}px)`,
          transition: pulling.current ? "none" : "transform 200ms ease, opacity 200ms ease",
        }}
        aria-hidden={indicatorOffset === 0}
      >
        {refreshing ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <RefreshCw className={`h-5 w-5 transition-transform ${reached ? "rotate-180" : ""}`} />
        )}
      </div>

      <PageHeader>
        <div className="flex items-center gap-3">
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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDeleteAllOpen(true)}
              aria-label="Delete all notifications"
              title="Delete all notifications"
              className="shrink-0 text-primary-foreground hover:bg-primary-foreground/10 dark:text-foreground dark:hover:bg-foreground/10"
            >
              <Trash2 className="h-5 w-5" />
            </Button>
          )}
        </div>
      </PageHeader>

      <AlertDialog open={deleteAllOpen} onOpenChange={setDeleteAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all notifications?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove all {items.length} notifications. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteAllOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                clearAll();
                setDeleteAllOpen(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="p-4 space-y-3 max-w-2xl mx-auto">
        {pushEnabled !== true && (
          <NotificationToggle mobile={mobile} />
        )}
        {items.length === 0 ? (
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
          <NotificationList items={visible} onOpen={openNotification} />
        )}
      </div>

      {items.length > 0 && (
        <button
          type="button"
          onClick={() => setUnreadOnly((v) => !v)}
          aria-pressed={unreadOnly}
          aria-label={unreadOnly ? "Showing unread only" : "Show unread only"}
          title={unreadOnly ? "Showing unread only" : "Show unread only"}
          className="fixed bottom-6 left-5 z-50 flex h-12 items-center justify-center gap-1.5 rounded-full bg-primary text-primary-foreground shadow-lg ring-1 ring-primary/30 hover:bg-primary/90 transition-all px-4 text-xs font-semibold"
          style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <Filter className="h-4 w-4" />
          {unreadOnly ? "Unread" : "All"}
        </button>
      )}

      {visible.length > 8 && showBackToTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Back to top"
          className="fixed bottom-6 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-1 ring-primary/30 hover:bg-primary/90 transition-all animate-in fade-in slide-in-from-bottom-2"
          style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      )}

      <button
        type="button"
        onClick={() => navigate("/")}
        aria-label="Go to home"
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-1 ring-primary/30 hover:bg-primary/90 transition-all animate-in fade-in slide-in-from-bottom-2"
        style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <Home className="h-5 w-5" />
      </button>
    </div>
  );
}

function NotificationRow({ n, onOpen }: { n: StoredNotification; onOpen: (n: StoredNotification) => void }) {
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
      onDelete={() => removeNotification(n.id)}
      onMarkRead={() => toggleRead(n.id)}
      onTap={() => onOpen(n)}
    >
      <Card
        className={`p-4 ${!n.read && !highlight ? "ring-1 ring-primary/50 bg-primary/5 border-l-4 border-l-primary" : ""} ${!n.read && highlight ? "ring-1 ring-primary/50 border-l-4 border-l-primary" : ""} ${highlight} ${n.read ? "opacity-80" : ""} cursor-pointer hover:bg-accent/40 transition-colors`}
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
            <img src={appLogo} alt="Mera Rashan" className="w-full h-full object-cover" loading="lazy" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground truncate">{n.title}</p>
              <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(n.receivedAt)}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap break-words">
              {n.body || <span className="italic opacity-60">No message body</span>}
            </p>
            {(n.month || n.year) && (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 ring-1 ring-primary/20 px-2.5 py-1 text-xs font-semibold text-primary">
                {n.month || ""}
                {n.month && n.year ? " " : ""}
                {n.year || ""}
              </p>
            )}
          </div>
        </div>
      </Card>
    </SwipeableNotification>
  );
}

/** Renders the notification list. Virtualizes (window scroll) once the list
 *  grows past a threshold; otherwise renders directly to keep the DOM simple. */
const VIRTUALIZE_THRESHOLD = 30;

function NotificationList({ items, onOpen }: { items: StoredNotification[]; onOpen: (n: StoredNotification) => void }) {
  if (items.length <= VIRTUALIZE_THRESHOLD) {
    return (
      <div className="space-y-3">
        {items.map((n) => (
          <NotificationRow key={n.id} n={n} onOpen={onOpen} />
        ))}
      </div>
    );
  }
  return <VirtualNotificationList items={items} onOpen={onOpen} />;
}

function VirtualNotificationList({ items, onOpen }: { items: StoredNotification[]; onOpen: (n: StoredNotification) => void }) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const virtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize: () => 132, // approx card + gap; dynamic measurement refines it
    overscan: 6,
    scrollMargin: parentRef.current?.offsetTop ?? 0,
    getItemKey: (i) => items[i].id,
  });
  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();
  const offset = virtualItems[0]?.start ?? 0;

  return (
    <div ref={parentRef} style={{ position: "relative" }}>
      <div style={{ height: totalSize, position: "relative" }}>
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            transform: `translateY(${offset - (virtualizer.options.scrollMargin ?? 0)}px)`,
          }}
        >
          {virtualItems.map((v) => (
            <div
              key={v.key}
              data-index={v.index}
              ref={virtualizer.measureElement}
              style={{ paddingBottom: 12 }}
            >
              <NotificationRow n={items[v.index]} onOpen={onOpen} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
