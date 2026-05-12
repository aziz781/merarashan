import { useEffect, useState } from "react";
import { Share, Plus } from "lucide-react";
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

const AndroidIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M17.6 9.48l1.84-3.18a.4.4 0 10-.69-.4l-1.86 3.22A11.4 11.4 0 0012 8c-1.78 0-3.46.4-4.9 1.12L5.25 5.9a.4.4 0 10-.69.4L6.4 9.48A10.7 10.7 0 001 18h22a10.7 10.7 0 00-5.4-8.52zM7 15.25a1.05 1.05 0 110-2.1 1.05 1.05 0 010 2.1zm10 0a1.05 1.05 0 110-2.1 1.05 1.05 0 010 2.1z"/>
  </svg>
);

const AppleIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M16.365 1.43c0 1.14-.42 2.18-1.13 2.95-.84.93-2.21 1.65-3.32 1.56-.14-1.1.42-2.27 1.13-3.04.79-.86 2.18-1.5 3.32-1.47zM20.5 17.27c-.55 1.27-.81 1.83-1.52 2.95-.99 1.55-2.39 3.48-4.13 3.5-1.55.02-1.95-1.01-4.05-1-2.1.01-2.54 1.02-4.09 1-1.74-.02-3.07-1.77-4.06-3.32C-.16 17.07-.45 12.18 1.83 9.6c1.61-1.83 4.16-2.9 6.55-2.9 2.43 0 3.96 1.33 5.97 1.33 1.95 0 3.13-1.34 5.94-1.34 2.13 0 4.39 1.16 6 3.17-5.27 2.89-4.41 10.42.21 7.41z"/>
  </svg>
);

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
  if (platform === "other") return null;

  const handleAndroidInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferredPrompt(null);
  };

  return (
    <>
      <div className="flex items-center justify-center pt-1">
        {platform === "android" ? (
          <button
            type="button"
            onClick={handleAndroidInstall}
            disabled={!deferredPrompt}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card/80 backdrop-blur text-sm font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-60"
            aria-label="Install app on Android"
          >
            <AndroidIcon className="w-4 h-4" />
            Install App
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowIosHelp(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card/80 backdrop-blur text-sm font-medium text-foreground hover:bg-accent transition-colors"
            aria-label="Install app on iOS"
          >
            <AppleIcon className="w-4 h-4" />
            Install App
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
