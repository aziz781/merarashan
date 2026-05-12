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

type InstallPromptWindow = Window & {
  __meraRashanInstallPrompt?: BeforeInstallPromptEvent | null;
  __meraRashanInstallPromptCallbacks?: Set<
    (event: BeforeInstallPromptEvent | null) => void
  >;
  __meraRashanInstallPromptListenerAttached?: boolean;
};

const getInstallPromptWindow = () => window as InstallPromptWindow;

function attachInstallPromptListener() {
  if (typeof window === "undefined") return;

  const promptWindow = getInstallPromptWindow();
  promptWindow.__meraRashanInstallPromptCallbacks ??= new Set();

  if (promptWindow.__meraRashanInstallPromptListenerAttached) return;
  promptWindow.__meraRashanInstallPromptListenerAttached = true;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    promptWindow.__meraRashanInstallPrompt = event as BeforeInstallPromptEvent;
    promptWindow.__meraRashanInstallPromptCallbacks?.forEach((callback) =>
      callback(promptWindow.__meraRashanInstallPrompt ?? null)
    );
  });
}

attachInstallPromptListener();

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

    const promptWindow = getInstallPromptWindow();
    if (promptWindow.__meraRashanInstallPrompt) {
      setDeferredPrompt(promptWindow.__meraRashanInstallPrompt);
    }

    const onPromptReady = (event: BeforeInstallPromptEvent | null) => {
      setDeferredPrompt(event);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      promptWindow.__meraRashanInstallPrompt = null;
    };

    promptWindow.__meraRashanInstallPromptCallbacks?.add(onPromptReady);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      promptWindow.__meraRashanInstallPromptCallbacks?.delete(onPromptReady);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  const handleClick = async () => {
    const promptEvent = deferredPrompt ?? getInstallPromptWindow().__meraRashanInstallPrompt;

    if (promptEvent) {
      try {
        await promptEvent.prompt();
        const { outcome } = await promptEvent.userChoice;
        if (outcome === "accepted") setInstalled(true);
        getInstallPromptWindow().__meraRashanInstallPrompt = null;
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
                ? "iOS requires adding the app from Safari:"
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
