import { supabase } from "@/integrations/supabase/client";

// Local store of received push notifications, persisted in localStorage.

export type StoredNotification = {
  id: string;
  title: string;
  body: string;
  url?: string;
  receivedAt: number; // epoch ms
  read: boolean;
  month?: string | null;
  year?: string | null;
};


const KEY = "mr_notifications_v1";
const DELETED_KEY = "mr_notifications_deleted_v1";
const MAX = 200;
const MAX_DELETED = 500;

function readDeleted(): string[] {
  try {
    const raw = localStorage.getItem(DELETED_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeDeleted(ids: string[]) {
  try {
    localStorage.setItem(DELETED_KEY, JSON.stringify(ids.slice(-MAX_DELETED)));
  } catch {
    /* ignore */
  }
}
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
  receivedAt?: number;
  month?: string | null;
  year?: string | null;
}): StoredNotification {
  const list = read();
  const deleted = readDeleted();
  const id = n.dedupeKey ? `k:${n.dedupeKey}` : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  // If user has previously deleted this notification, do not re-add it.
  if (deleted.includes(id)) {
    const existing = list.find((x) => x.id === id);
    return existing || ({ id, title: n.title || "", body: n.body || "", url: n.url, receivedAt: n.receivedAt || Date.now(), read: true, month: n.month ?? null, year: n.year ?? null } as StoredNotification);
  }
  // If a stable dedupe key is provided, never add the same one twice.
  if (n.dedupeKey) {
    const existing = list.find((x) => x.id === id);
    if (existing) return existing;
  }
  const item: StoredNotification = {
    id,
    title: n.title || "Notification",
    body: n.body || "",
    url: n.url,
    receivedAt: n.receivedAt || Date.now(),
    read: false,
    month: n.month ?? null,
    year: n.year ?? null,
  };
  // de-dupe identical notifications that arrive through both live push and inbox sync.
  // Use a wide window because inbox sync can run much later than the live push.
  const recent = list.find(
    (x) =>
      Math.abs(x.receivedAt - item.receivedAt) < 10 * 60 * 1000 &&
      x.title === item.title &&
      x.body === item.body,
  );
  if (recent) {
    // If this call carries a stable dedupeKey, adopt it on the existing entry
    // so subsequent syncs match by id and never duplicate.
    if (n.dedupeKey && recent.id !== id) {
      const updated = list.map((x) => (x === recent ? { ...x, id } : x));
      write(updated);
      return { ...recent, id };
    }
    return recent;
  }
  list.unshift(item);
  write(list);
  return item;
}

export async function syncNotificationInbox(): Promise<void> {
  const { data, error } = await supabase
    .from("notification_inbox")
    .select("id, title, body, url, created_at, month, year, read_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error || !data) return;
  for (const n of data.slice().reverse()) {
    addNotification({
      title: n.title,
      body: n.body || "",
      url: n.url || undefined,
      dedupeKey: `inbox:${n.id}`,
      receivedAt: new Date(n.created_at).getTime(),
      month: (n as { month?: string | null }).month ?? null,
      year: (n as { year?: string | null }).year ?? null,
    });
  }
  // Reconcile local read state with server-side read_at.
  const list = read();
  let changed = false;
  const next = list.map((n) => {
    const row = data.find((d) => `k:inbox:${d.id}` === n.id);
    if (!row) return n;
    const serverRead = !!row.read_at;
    if (serverRead !== n.read) {
      changed = true;
      return { ...n, read: serverRead };
    }
    return n;
  });
  if (changed) write(next);
}


function inboxIdFromLocalId(id: string): string | null {
  const prefix = "k:inbox:";
  return id.startsWith(prefix) ? id.slice(prefix.length) : null;
}

async function updateInboxReadAt(ids: string[], readAt: string | null) {
  const inboxIds = ids.map(inboxIdFromLocalId).filter((x): x is string => !!x);
  if (inboxIds.length === 0) return;
  try {
    await supabase
      .from("notification_inbox")
      .update({ read_at: readAt })
      .in("id", inboxIds);
  } catch {
    /* ignore */
  }
}

export function markAllRead() {
  const list = read();
  const changedIds = list.filter((n) => !n.read).map((n) => n.id);
  write(list.map((n) => ({ ...n, read: true })));
  void updateInboxReadAt(changedIds, new Date().toISOString());
}

export function markRead(id: string) {
  const list = read().map((n) => (n.id === id ? { ...n, read: true } : n));
  write(list);
  void updateInboxReadAt([id], new Date().toISOString());
}

export function markUnread(id: string) {
  const list = read().map((n) => (n.id === id ? { ...n, read: false } : n));
  write(list);
  void updateInboxReadAt([id], null);
}

export function toggleRead(id: string) {
  const current = read().find((n) => n.id === id);
  const nextRead = current ? !current.read : true;
  const list = read().map((n) => (n.id === id ? { ...n, read: nextRead } : n));
  write(list);
  void updateInboxReadAt([id], nextRead ? new Date().toISOString() : null);
}

export function removeNotification(id: string) {
  write(read().filter((n) => n.id !== id));
  const deleted = readDeleted();
  if (!deleted.includes(id)) {
    deleted.push(id);
    writeDeleted(deleted);
  }
}

export function clearAll() {
  const all = read();
  const deleted = readDeleted();
  for (const n of all) if (!deleted.includes(n.id)) deleted.push(n.id);
  writeDeleted(deleted);
  write([]);
}

export function unreadCount(): number {
  return read().filter((n) => !n.read).length;
}

export function subscribeNotifications(cb: () => void): () => void {
  const handler = () => cb();
  const storageHandler = (e: StorageEvent) => {
    if (e.key === KEY) handler();
  };
  window.addEventListener(EVENT, handler);
  window.addEventListener("storage", storageHandler);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener("storage", storageHandler);
  };
}
