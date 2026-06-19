import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { App } from "@capacitor/app";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "@/integrations/supabase/client";

// Use registerPlugin directly to avoid pulling the @capacitor-firebase/messaging
// web entry (which depends on `firebase`) into the web bundle. On native iOS the
// real plugin is provided by the installed Pod; on web these calls would throw,
// but we only ever invoke them after `isIOS()` returns true.
type PermStatus = "prompt" | "prompt-with-rationale" | "granted" | "denied";
interface FirebaseMessagingPlugin {
  checkPermissions(): Promise<{ receive: PermStatus }>;
  requestPermissions(): Promise<{ receive: PermStatus }>;
  getToken(): Promise<{ token: string }>;
  deleteToken(): Promise<void>;
  getDeliveredNotifications(): Promise<{
    notifications: Array<{ id?: string; title?: string; body?: string; data?: Record<string, unknown> }>;
  }>;
  removeAllListeners(): Promise<void>;
  addListener(
    event: "notificationReceived" | "notificationActionPerformed",
    cb: (event: { notification: { title?: string; body?: string; data?: Record<string, unknown> } }) => void,
  ): Promise<PluginListenerHandle>;
}
const FirebaseMessaging = registerPlugin<FirebaseMessagingPlugin>("FirebaseMessaging");

export function isNativePlatform(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function isIOS(): boolean {
  try {
    return Capacitor.getPlatform() === "ios";
  } catch {
    return false;
  }
}

let registered = false;
let currentToken: string | null = null;

/**
 * Request permission and register with FCM/APNs.
 * - Android: uses @capacitor/push-notifications (returns FCM token directly).
 * - iOS: uses @capacitor-firebase/messaging (Firebase iOS SDK swaps the APNs
 *   token for a real FCM token; @capacitor/push-notifications would only
 *   return the raw APNs token, which our FCM-based backend cannot use).
 */
export async function enableNativePush(mobile: string): Promise<string> {
  if (!isNativePlatform()) {
    throw new Error("Native push only available on Android/iOS app.");
  }
  if (!mobile) throw new Error("Missing mobile number");

  if (isIOS()) {
    const perm = await FirebaseMessaging.checkPermissions();
    let status = perm.receive;
    if (status === "prompt" || status === "prompt-with-rationale") {
      const req = await FirebaseMessaging.requestPermissions();
      status = req.receive;
    }
    if (status !== "granted") {
      throw new Error("Notification permission denied.");
    }
    const { token } = await FirebaseMessaging.getToken();
    if (!token) throw new Error("Failed to obtain FCM token on iOS");
    currentToken = token;
    const { error } = await supabase.functions.invoke("native-push-subscribe", {
      body: {
        mobile,
        fcm_token: token,
        platform: "ios",
        user_agent: navigator.userAgent,
      },
    });
    if (error) throw new Error(error.message || "Failed to save token");
    registered = true;
    return token;
  }

  const perm = await PushNotifications.checkPermissions();
  let status = perm.receive;
  if (status === "prompt" || status === "prompt-with-rationale") {
    const req = await PushNotifications.requestPermissions();
    status = req.receive;
  }
  if (status !== "granted") {
    throw new Error("Notification permission denied.");
  }

  return new Promise<string>((resolve, reject) => {
    const onReg = PushNotifications.addListener("registration", async (token) => {
      currentToken = token.value;
      try {
        const { error } = await supabase.functions.invoke("native-push-subscribe", {
          body: {
            mobile,
            fcm_token: token.value,
            platform: Capacitor.getPlatform(),
            user_agent: navigator.userAgent,
          },
        });
        if (error) throw new Error(error.message || "Failed to save token");
        registered = true;
        resolve(token.value);
      } catch (e) {
        reject(e);
      } finally {
        (await onReg).remove();
        (await onErr).remove();
      }
    });
    const onErr = PushNotifications.addListener("registrationError", async (err) => {
      reject(new Error(err.error || "Push registration failed"));
      (await onReg).remove();
      (await onErr).remove();
    });
    PushNotifications.register().catch(reject);
  });
}

export async function disableNativePush(): Promise<void> {
  if (!isNativePlatform()) return;
  const token = currentToken;
  try {
    if (isIOS()) {
      await FirebaseMessaging.removeAllListeners();
      try { await FirebaseMessaging.deleteToken(); } catch { /* ignore */ }
    } else {
      await PushNotifications.removeAllListeners();
    }
  } catch { /* ignore */ }
  if (token) {
    try {
      await supabase.functions.invoke("native-push-unsubscribe", {
        body: { fcm_token: token },
      });
    } catch { /* ignore */ }
  }
  currentToken = null;
  registered = false;
}

type ActionPayload = {
  url: string;
  notification: { title?: string; body?: string; data?: Record<string, unknown> };
};

// Module-level state so cold-start taps that arrive before React mounts
// are not lost. `earlyInitNativePush()` registers the tap listener as soon
// as JS executes; `initNativePushListeners()` later drains the queue.
let pendingActions: ActionPayload[] = [];
let actionHandler: ((p: ActionPayload) => void) | null = null;
let earlyInitDone = false;

function readUrlFromData(data: Record<string, unknown>): string {
  const value = data.url ?? data.link ?? data.deepLink ?? data.deeplink ?? data.path;
  return typeof value === "string" && value.trim() ? value : "/notifications";
}

function deliverAction(p: ActionPayload) {
  if (actionHandler) actionHandler(p);
  else pendingActions.push(p);
}

/**
 * Register the cold-start tap listener as early as possible (call from
 * main.tsx, before React renders). Tap events are queued until
 * `initNativePushListeners` provides an `onAction` handler.
 */
export async function earlyInitNativePush(): Promise<void> {
  if (earlyInitDone || !isNativePlatform()) return;
  earlyInitDone = true;
  try {
    if (isIOS()) {
      // iOS: Firebase Messaging emits the tap event; PushNotifications APNs
      // listener would not include FCM data payload mapping reliably.
      await FirebaseMessaging.addListener("notificationActionPerformed", (action) => {
        const n = action.notification || {};
        const data = ((n as { data?: Record<string, unknown> }).data || {}) as Record<string, unknown>;
        const url = readUrlFromData(data);
        const dTitle = typeof data.title === "string" ? data.title : undefined;
        const dBody = typeof data.body === "string" ? data.body : undefined;
        deliverAction({
          url,
          notification: {
            title: (n as { title?: string }).title || dTitle,
            body: (n as { body?: string }).body || dBody,
            data,
          },
        });
      });
    } else {
      await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
        const data = (action.notification.data || {}) as Record<string, unknown>;
        const url = readUrlFromData(data);
        const dTitle = typeof data.title === "string" ? data.title : undefined;
        const dBody = typeof data.body === "string" ? data.body : undefined;
        deliverAction({
          url,
          notification: {
            title: action.notification.title || dTitle,
            body: action.notification.body || dBody,
            data,
          },
        });
      });
    }
  } catch { /* ignore */ }
}

/**
 * Attach foreground/click handlers once at app start.
 * Foreground notifications are shown as toasts via the optional onForeground callback;
 * background taps navigate via the optional onAction callback.
 */
export async function initNativePushListeners(opts: {
  onForeground?: (n: { title?: string; body?: string; data?: Record<string, unknown> }) => void;
  onAction?: (url: string, n?: { title?: string; body?: string; data?: Record<string, unknown> }) => void;
  onDelivered?: (n: { id?: string; title?: string; body?: string; data?: Record<string, unknown> }) => void;
  onAppUrlOpen?: (url: string) => void;
}): Promise<void> {
  if (!isNativePlatform()) return;

  // Ensure a high-importance channel with sound + vibration exists on Android.
  if (Capacitor.getPlatform() === "android") {
    try {
      await PushNotifications.createChannel({
        id: "default",
        name: "Default",
        description: "General notifications",
        importance: 5, // IMPORTANCE_HIGH (heads-up + sound)
        visibility: 1,
        sound: "default",
        vibration: true,
        lights: true,
      });
    } catch { /* ignore */ }
  }

  if (isIOS()) {
    await FirebaseMessaging.addListener("notificationReceived", (event) => {
      const n = (event as { notification?: { title?: string; body?: string; data?: Record<string, unknown> } }).notification || {};
      const data = (n.data || {}) as Record<string, unknown>;
      const dBody = typeof data.body === "string" ? data.body : undefined;
      const dTitle = typeof data.title === "string" ? data.title : undefined;
      opts.onForeground?.({
        title: n.title || dTitle,
        body: n.body || dBody,
        data,
      });
    });
  } else {
    await PushNotifications.addListener("pushNotificationReceived", (notification) => {
      const data = (notification.data || {}) as Record<string, unknown>;
      const dBody = typeof data.body === "string" ? data.body : undefined;
      const dTitle = typeof data.title === "string" ? data.title : undefined;
      opts.onForeground?.({
        title: notification.title || dTitle,
        body: notification.body || dBody,
        data,
      });
    });
  }

  // Wire the early-init tap queue to the caller's handler.
  if (opts.onAction) {
    actionHandler = (p) => opts.onAction!(p.url, p.notification);
    if (pendingActions.length) {
      const queued = pendingActions;
      pendingActions = [];
      // Defer to next tick so React Router has a chance to finish mounting.
      setTimeout(() => queued.forEach((p) => actionHandler?.(p)), 0);
    }
  }

  // Safety net: if earlyInitNativePush() was never called, register here too.
  if (!earlyInitDone) await earlyInitNativePush();

  // Sync currently-delivered (tray) notifications into the in-app list
  // so background pushes show up even before the user taps them.
  const syncDelivered = async () => {
    try {
      const list = isIOS()
        ? (await FirebaseMessaging.getDeliveredNotifications()).notifications
        : (await PushNotifications.getDeliveredNotifications()).notifications;
      for (const n of list || []) {
        const data = ((n as { data?: Record<string, unknown> }).data || {}) as Record<string, unknown>;
        const dTitle = typeof data.title === "string" ? data.title : undefined;
        const dBody = typeof data.body === "string" ? data.body : undefined;
        opts.onDelivered?.({
          id: typeof (n as { id?: string }).id === "string" ? (n as { id?: string }).id : undefined,
          title: (n as { title?: string }).title || dTitle,
          body: (n as { body?: string }).body || dBody,
          data,
        });
      }
    } catch { /* ignore */ }
  };
  await syncDelivered();
  window.addEventListener("focus", () => void syncDelivered());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void syncDelivered();
  });

  await App.addListener("appUrlOpen", ({ url }) => {
    opts.onAppUrlOpen?.(url || "/notifications");
  });

  try {
    const launch = await App.getLaunchUrl();
    if (launch?.url) opts.onAppUrlOpen?.(launch.url);
  } catch { /* ignore */ }
}
