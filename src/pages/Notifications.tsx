import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, Trash2, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import appLogo from "@/assets/mera-rashan-logo.png";
import {
  clearAll,
  getNotifications,
  markAllRead,
  removeNotification,
  subscribeNotifications,
  type StoredNotification,
} from "@/lib/notificationsStore";

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

export default function Notifications() {
  const navigate = useNavigate();
  const [items, setItems] = useState<StoredNotification[]>(() => getNotifications());

  useEffect(() => {
    const unsub = subscribeNotifications(() => setItems(getNotifications()));
    // mark all as read on visit
    markAllRead();
    setItems(getNotifications());
    return unsub;
  }, []);

  const openNotification = (n: StoredNotification) => {
    if (!n.url) return;
    if (/^https?:\/\//i.test(n.url)) window.location.assign(n.url);
    else navigate(n.url);
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
            <h1 className="text-xl font-bold leading-tight">Notifications</h1>
            <p className="text-xs opacity-80">{items.length} total</p>
          </div>
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => {
                clearAll();
                setItems([]);
              }}
              aria-label="Clear all"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm ring-1 ring-white/25 hover:bg-white/25 transition-colors"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          )}
        </div>
      </header>

      <div className="p-4 space-y-3 max-w-2xl mx-auto">
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
        ) : (
          items.map((n) => (
            <Card
              key={n.id}
              className={`p-4 ${n.url ? "cursor-pointer hover:bg-accent/40 transition-colors" : ""}`}
              onClick={() => openNotification(n)}
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Bell className="w-4 h-4 text-primary" />
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
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0"
                  aria-label="Remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeNotification(n.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))
        )}

        {items.length > 0 && (
          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                markAllRead();
                setItems(getNotifications());
              }}
            >
              <CheckCheck className="w-4 h-4" />
              Mark all as read
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
