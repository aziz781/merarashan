import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { App } from "@capacitor/app";
import { PushNotifications } from "@capacitor/push-notifications";
import { LocalNotifications } from "@capacitor/local-notifications";
import { NativeSettings, AndroidSettings, IOSSettings } from "capacitor-native-settings";
import { supabase } from "@/integrations/supabase/client";

/**
 * Present a system heads-up notification while the app is in the foreground.
 * FCM / APNs suppress tray notifications when the app is open, so we mirror
 * the push as a local notification so the user actually sees a banner.
 */
let localNotifsReady: Promise<boolean> | null = null;
const FOREGROUND_ANDROID_CHANNEL_ID = "foreground_alerts";

async function ensureLocalNotifsPermission(): Promise<boolean> {
  if (!isNativePlatform()) return false;
  if (!localNotifsReady) {
    localNotifsReady = (async () => {
      try {
        const perm = await LocalNotifications.checkPermissions();
        let granted = perm.display === "granted";
        if (!granted) {
          const req = await LocalNotifications.requestPermissions();
          granted = req.display === "granted";
        }
        if (granted && Capacitor.getPlatform() === "android") {
          // Android channels are immutable after creation. Use a dedicated
          // foreground channel instead of the app's old/default FCM channel so
          // foreground mirrors can be high-importance heads-up banners.
          try {
            await LocalNotifications.createChannel({
              id: FOREGROUND_ANDROID_CHANNEL_ID,
              name: "Foreground alerts",
              description: "Notifications shown while Mera Rashan is open",
              importance: 5, // IMPORTANCE_MAX (heads-up + sound)
              visibility: 1,
              vibration: true,
              lights: true,
            });
          } catch { /* ignore */ }
        }
        return granted;
      } catch {
        return false;
      }
    })();
  }
  return localNotifsReady;
}


async function presentForegroundLocalNotification(n: {
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  try {
    const ok = await ensureLocalNotifsPermission();
    if (!ok) return;
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Math.random() * 2_000_000_000),
          title: n.title || "Notification",
          body: n.body || "",
          channelId: Capacitor.getPlatform() === "android" ? FOREGROUND_ANDROID_CHANNEL_ID : "default",
          sound: "default",
          extra: n.data || {},
          autoCancel: true,
        },
      ],
    });
  } catch { /* ignore */ }
}



/**
 * Deep-link the user into the OS settings page for this app's notifications.
 * Apps cannot toggle the system notification switch programmatically; this
 * opens the exact screen so the user can flip it in one tap.
 */
export async function openAppNotificationSettings(): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    if (isIOS()) {
      await NativeSettings.openIOS({ option: IOSSettings.App });
    } else {
      await NativeSettings.openAndroid({ option: AndroidSettings.AppNotification });
    }
  } catch {
    /* ignore */
  }
}

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

export function isIOSNative(): boolean {
  return isNativePlatform() && isIOS();
}

/**
 * Returns the current OS notification permission on iOS. UI uses this to
 * decide between (a) showing a rationale before prompting, (b) registering
 * straight away when already granted, or (c) directing the user to Settings.
 */
export async function getIOSNotificationPermission(): Promise<PermStatus | "unknown"> {
  if (!isIOSNative()) return "unknown";
  try {
    const { receive } = await FirebaseMessaging.checkPermissions();
    return receive;
  } catch {
    return "unknown";
  }
}

let registered = false;
let currentToken: string | null = null;

export function isAndroidNative(): boolean {
  try {
    return isNativePlatform() && Capacitor.getPlatform() === "android";
  } catch {
    return false;
  }
}

/**
 * Returns the current OS notification permission on Android. UI uses this to
 * decide between showing a rationale before prompting (POST_NOTIFICATIONS on
 * Android 13+), registering immediately when already granted, or directing
 * the user to system Settings when denied.
 */
export async function getAndroidNotificationPermission(): Promise<PermStatus | "unknown"> {
  if (!isAndroidNative()) return "unknown";
  try {
    const { receive } = await PushNotifications.checkPermissions();
    return receive as PermStatus;
  } catch {
    return "unknown";
  }
}

/** Unified permission check across iOS/Android native. */
export async function getNativeNotificationPermission(): Promise<PermStatus | "unknown"> {
  if (isIOSNative()) return getIOSNotificationPermission();
  if (isAndroidNative()) return getAndroidNotificationPermission();
  return "unknown";
}

/** Request OS permission (shows the native system prompt if status is "prompt"). */
export async function requestNativeNotificationPermission(): Promise<PermStatus | "unknown"> {
  try {
    if (isIOSNative()) {
      const { receive } = await FirebaseMessaging.requestPermissions();
      return receive;
    }
    if (isAndroidNative()) {
      const { receive } = await PushNotifications.requestPermissions();
      return receive as PermStatus;
    }
  } catch {
    return "unknown";
  }
  return "unknown";
}

/**
 * On native app start: check the OS notification setting. If the user has not
 * answered yet, show the native system prompt. When permission is granted and
 * a mobile is known, silently register/refresh the FCM token.
 * Returns the final permission status.
 */
export async function ensureNativeNotificationsOnStart(
  mobile: string | null,
): Promise<PermStatus | "unknown"> {
  if (!isNativePlatform()) return "unknown";
  // Respect explicit user opt-out from the Settings toggle: if the user
  // tapped "Disable", do NOT prompt or re-register on subsequent launches.
  let userDisabled = false;
  try {
    const v = localStorage.getItem("mr_native_push_enabled");
    // Treat an explicit "0" as opted-out. Absent key = first run -> prompt.
    userDisabled = v === "0";
  } catch { /* ignore */ }
  if (userDisabled) return await getNativeNotificationPermission();

  let status = await getNativeNotificationPermission();
  if (status === "prompt" || status === "prompt-with-rationale") {
    status = await requestNativeNotificationPermission();
  }
  if (status === "granted" && mobile) {
    try {
      await enableNativePush(mobile);
      try { localStorage.setItem("mr_native_push_enabled", "1"); } catch { /* ignore */ }
    } catch { /* ignore — UI toggle will reflect real state */ }
  }
  return status;
}

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
    // iOS: FCM token requires an APNs token first. Trigger APNs registration
    // via @capacitor/push-notifications so AppDelegate forwards the device
    // token to Firebase Messaging (Messaging.messaging().apnsToken = ...).
    try {
      await PushNotifications.register();
    } catch { /* ignore — getToken will surface a clearer error */ }
    // Poll briefly for the FCM token — APNs registration is async.
    let token = "";
    for (let i = 0; i < 10; i++) {
      try {
        const res = await FirebaseMessaging.getToken();
        if (res?.token) { token = res.token; break; }
      } catch { /* retry */ }
      await new Promise((r) => setTimeout(r, 500));
    }
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

  // Foreground delivery. iOS attaches BOTH listeners because whichever
  // plugin grabbed the UNUserNotificationCenter delegate first will be the
  // one that actually receives the event — dedupe on a recent-key cache.
  const recentForeground = new Map<string, number>();
  const recentBanner = new Map<string, number>();
  const FG_DEDUPE_MS = 4000;
  const makeKey = (n: { title?: string; body?: string }) => `${n.title || ""}|${n.body || ""}`;
  const fireForeground = (n: { title?: string; body?: string; data?: Record<string, unknown> }) => {
    const key = makeKey(n);
    const now = Date.now();
    // GC old entries
    if (recentForeground.size > 50) {
      for (const [k, t] of recentForeground) {
        if (now - t > FG_DEDUPE_MS) recentForeground.delete(k);
      }
      for (const [k, t] of recentBanner) {
        if (now - t > FG_DEDUPE_MS) recentBanner.delete(k);
      }
    }
    // Dedupe the in-app modal/inbox callback…
    const seen = recentForeground.get(key);
    if (!seen || now - seen >= FG_DEDUPE_MS) {
      recentForeground.set(key, now);
      opts.onForeground?.(n);
    }
    // …and independently dedupe the heads-up banner mirror.
    const seenBanner = recentBanner.get(key);
    if (!seenBanner || now - seenBanner >= FG_DEDUPE_MS) {
      recentBanner.set(key, now);
      void presentForegroundLocalNotification(n);
    }
  };

  // Attach BOTH native foreground listeners on every platform. On iOS,
  // whichever plugin grabs UNUserNotificationCenter.delegate first wins the
  // event — listening to only one risks missing foreground notifications.
  // Dedupe (title+body) keeps the modal/banner single.
  try {
    await FirebaseMessaging.addListener("notificationReceived", (event) => {
      const n = (event as { notification?: { title?: string; body?: string; data?: Record<string, unknown> } }).notification || {};
      const data = (n.data || {}) as Record<string, unknown>;
      const dBody = typeof data.body === "string" ? data.body : undefined;
      const dTitle = typeof data.title === "string" ? data.title : undefined;
      fireForeground({ title: n.title || dTitle, body: n.body || dBody, data });
    });
  } catch { /* ignore */ }

  {
    await PushNotifications.addListener("pushNotificationReceived", (notification) => {
      const data = (notification.data || {}) as Record<string, unknown>;
      const dBody = typeof data.body === "string" ? data.body : undefined;
      const dTitle = typeof data.title === "string" ? data.title : undefined;
      fireForeground({
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
