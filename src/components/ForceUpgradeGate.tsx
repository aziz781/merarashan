import { useEffect, useState, type ReactNode } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { isNativeCapacitor } from "@/lib/isNative";
import { AlertTriangle, Download, X } from "lucide-react";

type VersionConfig = {
  platform: "android" | "ios" | "web";
  min_supported_version_code: number;
  latest_version_code: number;
  latest_version_name: string;
  store_url: string;
};

const DISMISS_KEY = "mr_upgrade_banner_dismissed_for";

async function getInstalled(): Promise<{ platform: "android" | "ios" | "web"; code: number } | null> {
  const platform = Capacitor.getPlatform() as "android" | "ios" | "web";
  if (platform === "web") {
    const code = parseInt(String(__APP_VERSION_CODE__), 10);
    return Number.isFinite(code) ? { platform, code } : null;
  }
  try {
    const info = await CapApp.getInfo();
    const code = parseInt(info.build, 10);
    return Number.isFinite(code) ? { platform, code } : null;
  } catch {
    return null;
  }
}

async function openStore(url: string) {
  try {
    if (isNativeCapacitor) {
      const { Browser } = await import("@capacitor/browser").catch(() => ({ Browser: null as never }));
      if (Browser) {
        await Browser.open({ url });
        return;
      }
    }
  } catch { /* fall through */ }
  window.open(url, "_blank", "noopener,noreferrer");
}

export function ForceUpgradeGate({ children }: { children: ReactNode }) {
  const [blocked, setBlocked] = useState<VersionConfig | null>(null);
  const [suggest, setSuggest] = useState<VersionConfig | null>(null);
  const [dismissed, setDismissed] = useState<number | null>(() => {
    try {
      const v = localStorage.getItem(DISMISS_KEY);
      return v ? parseInt(v, 10) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    // Only Android/iOS are gated. Web is skipped entirely.
    if (!isNativeCapacitor) return;

    let cancelled = false;

    const check = async () => {
      const installed = await getInstalled();
      if (!installed || installed.platform === "web") return;

      const { data, error } = await supabase
        .from("app_version_config")
        .select("*")
        .eq("platform", installed.platform)
        .maybeSingle();
      if (cancelled || error || !data) return;

      const cfg = data as VersionConfig;
      if (installed.code < cfg.min_supported_version_code) {
        setBlocked(cfg);
        setSuggest(null);
      } else if (installed.code < cfg.latest_version_code) {
        setBlocked(null);
        setSuggest(cfg);
      } else {
        setBlocked(null);
        setSuggest(null);
      }
    };

    void check();

    const sub = CapApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) void check();
    });

    return () => {
      cancelled = true;
      void sub.then((s) => s.remove());
    };
  }, []);

  const dismissSuggest = () => {
    if (!suggest) return;
    try {
      localStorage.setItem(DISMISS_KEY, String(suggest.latest_version_code));
    } catch { /* ignore */ }
    setDismissed(suggest.latest_version_code);
  };

  if (blocked) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 backdrop-blur p-6">
        <div className="max-w-sm w-full rounded-2xl border border-border bg-card p-6 shadow-lg text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Update required</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            A newer version of Mera Rashan is available. Please update to continue using the app.
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Latest version: <span className="font-medium text-foreground">{blocked.latest_version_name}</span>
          </p>
          <Button className="mt-5 w-full" onClick={() => void openStore(blocked.store_url)}>
            <Download className="mr-2 h-4 w-4" />
            Update now
          </Button>
        </div>
      </div>
    );
  }

  const showSuggest = suggest && dismissed !== suggest.latest_version_code;

  return (
    <>
      {children}
      {showSuggest && suggest && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-background/80 backdrop-blur-sm p-6">
          <div className="max-w-sm w-full rounded-2xl border border-border bg-card p-6 shadow-lg text-center relative">
            <button
              type="button"
              aria-label="Dismiss"
              className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted"
              onClick={dismissSuggest}
            >
              <X className="h-4 w-4" />
            </button>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Download className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">New version available</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              A newer version of Mera Rashan is available. Update now for the latest features and improvements.
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              Latest version: <span className="font-medium text-foreground">{suggest.latest_version_name}</span>
            </p>
            <Button className="mt-5 w-full" onClick={() => void openStore(suggest.store_url)}>
              <Download className="mr-2 h-4 w-4" />
              Go to {Capacitor.getPlatform() === "ios" ? "App Store" : "Play Store"}
            </Button>
            <button
              type="button"
              className="mt-3 text-sm text-muted-foreground hover:text-foreground"
              onClick={dismissSuggest}
            >
              Later
            </button>
          </div>
        </div>
      )}
    </>
  );
}
