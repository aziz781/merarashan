import { useEffect, useState } from "react";
import { Download, Share, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia?.("(display-mode: standalone)").matches;
  // iOS Safari
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean })
    .standalone === true;
  return Boolean(mq || iosStandalone);
}

function detectPlatform(): "ios" | "android" | "other" {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

export function InstallAppLinks() {
  const [installed, setInstalled] = useState<boolean>(() => isStandalone());
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<"ios" | "android" | "other">("other");
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };
    const mq = window.matchMedia("(display-mode: standalone)");
    const handleDisplayChange = () => setInstalled(isStandalone());

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);
    mq.addEventListener?.("change", handleDisplayChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
      mq.removeEventListener?.("change", handleDisplayChange);
    };
  }, []);

  if (installed) return null;

  const handleAndroidInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setInstalled(true);
    }
    setDeferredPrompt(null);
  };

  // Show Android button only if browser supports install prompt OR user is on Android
  const showAndroid =
    platform === "android" || (platform === "other" && Boolean(deferredPrompt));
  const showIos = platform === "ios" || platform === "other";

  return (
    <>
      <div className="flex items-center justify-center gap-2 pt-2">
        {showAndroid && (
          <button
            type="button"
            onClick={handleAndroidInstall}
            disabled={!deferredPrompt}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-60"
            aria-label="Install app on Android"
          >
            <Download className="w-3.5 h-3.5" />
            Install on Android
          </button>
        )}
        {showIos && (
          <button
            type="button"
            onClick={() => setShowIosHelp(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-medium text-foreground hover:bg-accent transition-colors"
            aria-label="Install app on iOS"
          >
            <Download className="w-3.5 h-3.5" />
            Install on iOS
          </button>
        )}
      </div>

      <Dialog open={showIosHelp} onOpenChange={setShowIosHelp}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Install on iPhone / iPad</DialogTitle>
            <DialogDescription>
              Open this site in Safari, then follow these steps:
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 text-sm text-foreground">
            <li className="flex items-start gap-2">
              <span className="font-semibold">1.</span>
              <span className="flex items-center gap-1.5">
                Tap the Share icon
                <Share className="w-4 h-4 inline" />
                in the toolbar.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold">2.</span>
              <span className="flex items-center gap-1.5">
                Choose <strong>Add to Home Screen</strong>
                <Plus className="w-4 h-4 inline" />.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold">3.</span>
              <span>Tap <strong>Add</strong> to finish.</span>
            </li>
          </ol>
        </DialogContent>
      </Dialog>
    </>
  );
}
