import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { earlyInitNativePush } from "@/lib/nativePush";

// Register the cold-start push-tap listener before React mounts so taps
// that launch the app from a killed state are not dropped.
void earlyInitNativePush();

createRoot(document.getElementById("root")!).render(<App />);

// Hide the inline splash once React has painted the first frame.
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    const splash = document.getElementById("app-splash");
    if (!splash) return;
    splash.classList.add("app-splash-hide");
    setTimeout(() => splash.remove(), 300);
  });
});

// Service worker registration — only on production hosts, never in Lovable preview/iframe.
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const host = window.location.hostname;
const isPreviewHost =
  host.includes("id-preview--") ||
  host.includes("preview--") ||
  host.includes("lovableproject.com") ||
  host.includes("lovableproject-dev.com");
const isNativeCapacitor = (() => {
  try {
    return !!(window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
})();

if (isPreviewHost || isInIframe || isNativeCapacitor) {
  // Clean up any previously-registered service workers in preview/iframe contexts.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister());
    });
  }
} else if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    import("virtual:pwa-register")
      .then(({ registerSW }) => {
        const updateSW = registerSW({
          immediate: true,
          onNeedRefresh() {
            // Auto-reload when a new build is ready so users always see the latest version.
            window.location.reload();
          },
          onRegistered(r) {
            if (!r) return;
            // Re-check for updates every 30 minutes while the page is open.
            setInterval(() => {
              r.update();
            }, 30 * 60 * 1000);
          },
        });

        // Also check for updates when the app comes back to the foreground.
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") {
            navigator.serviceWorker.ready.then((reg) => reg.update());
          }
        });
      })
      .catch(() => {
        // PWA register module not available; ignore.
      });
  });
}
