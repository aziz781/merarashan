import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+
  return /Macintosh/.test(ua) && (navigator as any).maxTouchPoints > 1;
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

export function InstallAppLinks() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (isStandalone()) setInstalled(true);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  const handleClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") setInstalled(true);
        setDeferredPrompt(null);
        return;
      } catch {
        // fall through to manual help
      }
    }
    setShowHelp(true);
  };

  const ios = isIOS();

  return (
    <>
      <Button
        type="button"
        onClick={handleClick}
        variant="outline"
        className="w-full justify-center gap-2"
      >
        <Download className="w-4 h-4" />
        Install Mera Rashan App
      </Button>

      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Install Mera Rashan App</DialogTitle>
            <DialogDescription>
              {ios
                ? "Add to your Home Screen in 3 steps:"
                : "Install from your browser menu in 3 steps:"}
            </DialogDescription>
          </DialogHeader>
          <ol className="list-decimal pl-5 text-sm space-y-1.5">
            {ios ? (
              <>
                <li>Tap the Share button in Safari.</li>
                <li>Choose “Add to Home Screen”.</li>
                <li>Tap “Add” to confirm.</li>
              </>
            ) : (
              <>
                <li>Open your browser menu (⋮).</li>
                <li>Tap “Install app” or “Add to Home screen”.</li>
                <li>Confirm to install.</li>
              </>
            )}
          </ol>
        </DialogContent>
      </Dialog>
    </>
  );
}
