// Local store of received push notifications, persisted in localStorage.

export type StoredNotification = {
  id: string;
  title: string;
  body: string;
  url?: string;
  receivedAt: number; // epoch ms
  read: boolean;
};

const KEY = "mr_notifications_v1";
const MAX = 200;
const EVENT = "mr-notifications-changed";

function read(): StoredNotification[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function write(list: StoredNotification[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {
    /* ignore */
  }
}

export function getNotifications(): StoredNotification[] {
  return read().sort((a, b) => b.receivedAt - a.receivedAt);
}

export function addNotification(n: {
  title?: string;
  body?: string;
  url?: string;
  dedupeKey?: string;
}): StoredNotification {
  const list = read();
  // If a stable dedupe key is provided, never add the same one twice.
  if (n.dedupeKey) {
    const existing = list.find((x) => x.id === `k:${n.dedupeKey}`);
    if (existing) return existing;
  }
  const item: StoredNotification = {
    id: n.dedupeKey ? `k:${n.dedupeKey}` : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: n.title || "Notification",
    body: n.body || "",
    url: n.url,
    receivedAt: Date.now(),
    read: false,
  };
  // de-dupe identical notification arriving within 3s (for sources without a key)
  if (!n.dedupeKey) {
    const recent = list.find(
      (x) =>
        Math.abs(x.receivedAt - item.receivedAt) < 3000 &&
        x.title === item.title &&
        x.body === item.body,
    );
    if (recent) return recent;
  }
  list.unshift(item);
  write(list);
  return item;
}

export function markAllRead() {
  const list = read().map((n) => ({ ...n, read: true }));
  write(list);
}

export function removeNotification(id: string) {
  write(read().filter((n) => n.id !== id));
}

export function clearAll() {
  write([]);
}

export function unreadCount(): number {
  return read().filter((n) => !n.read).length;
}

export function subscribeNotifications(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener(EVENT, handler);
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) handler();
  });
  return () => window.removeEventListener(EVENT, handler);
}
