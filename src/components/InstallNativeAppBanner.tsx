import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isNativePlatform } from "@/lib/nativePush";

const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=pk.merarashan.app";
const DISMISS_KEY = "mr_install_native_dismissed_at";
const DISMISS_DAYS = 7;

function isAndroid() {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent || "");
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

function recentlyDismissed() {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export function InstallNativeAppBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isNativePlatform()) return; // already inside the native app
    if (!isAndroid()) return; // only Android native build available
    if (isStandalone()) return; // installed PWA — don't nag
    if (recentlyDismissed()) return;
    setShow(true);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    setShow(false);
  };

  return (
    <div className="sticky top-0 z-50 w-full bg-primary text-primary-foreground shadow-md">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-3 py-2">
        <Download className="h-5 w-5 shrink-0" />
        <div className="flex-1 text-sm leading-tight">
          <div className="font-semibold">Get the Mera Rashan app</div>
          <div className="text-xs opacity-90">
            Faster experience with notifications.
          </div>
        </div>
        <Button
          asChild
          size="sm"
          variant="secondary"
          className="h-8 px-3 text-xs font-semibold"
        >
          <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer">
            Install
          </a>
        </Button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="rounded p-1 text-primary-foreground/80 hover:bg-primary-foreground/10"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
