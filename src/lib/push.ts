import { supabase } from "@/integrations/supabase/client";

// Public VAPID key — safe to ship in client code.
export const VAPID_PUBLIC_KEY =
  "BOHJmS8q7TDf9zry73X6aK1B7IVRqB2NTqvZCPPgCGeFNMRPQlxxFEOcgXW-TQraAIws6tU0oDOWdVEzTqZQ0qc";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

function bufToBase64(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let str = "";
  for (let i = 0; i < bytes.byteLength; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str);
}

function bufToBase64Url(buf: ArrayBuffer | null): string {
  return bufToBase64(buf).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function subscriptionMatchesKey(sub: PushSubscription, vapidPublicKey: string): boolean {
  const key = sub.options?.applicationServerKey;
  if (!key) return false;
  return bufToBase64Url(key) === vapidPublicKey.replace(/=+$/g, "");
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return null;
  return await reg.pushManager.getSubscription();
}

export async function enablePush(mobile: string): Promise<PushSubscription> {
  if (!pushSupported()) throw new Error("Push not supported on this device.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notifications permission denied.");

  const reg =
    (await navigator.serviceWorker.getRegistration()) ||
    (await navigator.serviceWorker.ready);
  if (!reg) throw new Error("Service worker not available. Try again in a moment.");

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const key = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    const ab = new ArrayBuffer(key.byteLength);
    new Uint8Array(ab).set(key);
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: ab,
    });
  }

  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  const payload = {
    mobile,
    endpoint: json.endpoint || sub.endpoint,
    p256dh: json.keys?.p256dh || bufToBase64(sub.getKey("p256dh")),
    auth: json.keys?.auth || bufToBase64(sub.getKey("auth")),
    user_agent: navigator.userAgent,
  };

  const { error } = await supabase.functions.invoke("push-subscribe", { body: payload });
  if (error) throw new Error(error.message || "Failed to save subscription");
  return sub;
}

export async function disablePush(): Promise<void> {
  const sub = await getCurrentSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  try {
    await sub.unsubscribe();
  } catch (_) {
    /* ignore */
  }
  await supabase.functions.invoke("push-unsubscribe", { body: { endpoint } });
}

/**
 * Detect a VAPID public-key change and silently re-subscribe so the user keeps
 * receiving notifications without manually toggling off/on.
 *
 * Safe to call on app load: it only acts when permission is already granted
 * and an existing subscription is bound to a different applicationServerKey.
 */
export async function syncPushSubscription(mobile: string): Promise<"unchanged" | "resubscribed" | "skipped"> {
  if (!pushSupported()) return "skipped";
  if (Notification.permission !== "granted") return "skipped";
  if (!mobile) return "skipped";

  const reg =
    (await navigator.serviceWorker.getRegistration()) ||
    (await navigator.serviceWorker.ready);
  if (!reg) return "skipped";

  const existing = await reg.pushManager.getSubscription();
  if (existing && subscriptionMatchesKey(existing, VAPID_PUBLIC_KEY)) {
    return "unchanged";
  }

  if (existing) {
    const oldEndpoint = existing.endpoint;
    try {
      await existing.unsubscribe();
    } catch (_) {
      /* ignore */
    }
    try {
      await supabase.functions.invoke("push-unsubscribe", { body: { endpoint: oldEndpoint } });
    } catch (_) {
      /* ignore — old endpoint may already be gone */
    }
  }

  await enablePush(mobile);
  return "resubscribed";
}
