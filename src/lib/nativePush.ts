import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "@/integrations/supabase/client";

export function isNativePlatform(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

let registered = false;
let currentToken: string | null = null;

/**
 * Request permission and register with FCM/APNs.
 * On success, the device's FCM token is upserted to the backend via
 * the `native-push-subscribe` edge function.
 */
export async function enableNativePush(mobile: string): Promise<string> {
  if (!isNativePlatform()) {
    throw new Error("Native push only available on Android/iOS app.");
  }
  if (!mobile) throw new Error("Missing mobile number");

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
    await PushNotifications.removeAllListeners();
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

/**
 * Attach foreground/click handlers once at app start.
 * Foreground notifications are shown as toasts via the optional onForeground callback;
 * background taps navigate via the optional onAction callback.
 */
export async function initNativePushListeners(opts: {
  onForeground?: (n: { title?: string; body?: string; data?: Record<string, unknown> }) => void;
  onAction?: (url: string, n?: { title?: string; body?: string }) => void;
  onDelivered?: (n: { id?: string; title?: string; body?: string; data?: Record<string, unknown> }) => void;
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

  await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    const data = (action.notification.data || {}) as Record<string, unknown>;
    const url = typeof data.url === "string" ? data.url : "/";
    const dBody = typeof data.body === "string" ? data.body : undefined;
    const dTitle = typeof data.title === "string" ? data.title : undefined;
    opts.onAction?.(url, {
      title: action.notification.title || dTitle,
      body: action.notification.body || dBody,
    });
  });

  // Sync currently-delivered (tray) notifications into the in-app list
  // so background pushes show up even before the user taps them.
  const syncDelivered = async () => {
    try {
      const { notifications } = await PushNotifications.getDeliveredNotifications();
      for (const n of notifications || []) {
        const data = (n.data || {}) as Record<string, unknown>;
        const dTitle = typeof data.title === "string" ? data.title : undefined;
        const dBody = typeof data.body === "string" ? data.body : undefined;
        opts.onDelivered?.({
          id: typeof (n as { id?: string }).id === "string" ? (n as { id?: string }).id : undefined,
          title: n.title || dTitle,
          body: n.body || dBody,
          data,
        });
      }
    } catch { /* ignore */ }
  };
  await syncDelivered();
  try {
    const { App } = await import("@capacitor/app");
    App.addListener("appStateChange", (state) => {
      if (state.isActive) void syncDelivered();
    });
  } catch { /* ignore */ }
}
