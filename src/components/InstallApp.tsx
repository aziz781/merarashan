import { useEffect, useState } from "react";
import { Download, Share, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallApp() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
    setIsIOS(ios);

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS Safari
      window.navigator.standalone === true;
    setInstalled(standalone);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  const handleInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  return (
    <Card className="mx-5 p-4 bg-card/80 backdrop-blur shadow-[var(--shadow-soft)] border-border/50">
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-primary-foreground"
          style={{ background: "var(--gradient-primary)" }}
        >
          <Download className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Install App</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Get a faster, app-like experience on your device.
          </p>

          {deferred ? (
            <Button
              onClick={handleInstall}
              size="sm"
              className="mt-3 h-9 font-semibold text-primary-foreground border-0 hover:opacity-90"
              style={{ background: "var(--gradient-primary)" }}
            >
              Install
            </Button>
          ) : isIOS ? (
            <p className="text-xs text-muted-foreground mt-2 inline-flex items-center gap-1 flex-wrap">
              Tap <Share className="w-3.5 h-3.5 inline" /> Share, then{" "}
              <Plus className="w-3.5 h-3.5 inline" /> Add to Home Screen.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-2">
              Open your browser menu and choose "Install app" or "Add to Home screen".
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
