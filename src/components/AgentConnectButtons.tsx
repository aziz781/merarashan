import { useEffect, useState } from "react";
import { ExternalLink, Loader2, Plug } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const PROJECT_REF = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;
const MCP_URL = `${SUPABASE_URL}/functions/v1/mcp`;
const ISSUER = `https://${PROJECT_REF}.supabase.co/auth/v1`;

const AGENTS: { name: string; connectorsUrl: string }[] = [
  { name: "Claude", connectorsUrl: "https://claude.ai/settings/connectors" },
  { name: "ChatGPT", connectorsUrl: "https://chatgpt.com/#settings/Connectors" },
];

type Status = "checking" | "ready" | "unavailable";

export function AgentConnectButtons() {
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("checking");

  const refresh = async () => {
    setStatus("checking");
    try {
      const [{ data: sess }, mcpRes, issuerRes] = await Promise.all([
        supabase.auth.getSession(),
        fetch(`${MCP_URL}/.well-known/oauth-protected-resource`, { cache: "no-store" }).catch(() => null),
        fetch(`${ISSUER}/.well-known/oauth-authorization-server`, { cache: "no-store" }).catch(() => null),
      ]);
      const ok = !!sess.session && !!mcpRes?.ok && !!issuerRes?.ok;
      setStatus(ok ? "ready" : "unavailable");
    } catch {
      setStatus("unavailable");
    }
  };

  useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    const id = window.setInterval(refresh, 30_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(id);
    };
  }, []);

  const connect = async (name: string, url: string) => {
    setBusy(name);
    try {
      try {
        await navigator.clipboard.writeText(MCP_URL);
        toast.success("MCP URL copied — paste it in the connector dialog", { duration: 5000 });
      } catch {
        toast.message("Copy the MCP URL manually and paste it in the connector dialog");
      }
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setTimeout(() => setBusy(null), 800);
    }
  };

  const statusLabel =
    status === "ready" ? "Ready to connect" : status === "checking" ? "Checking…" : "Unavailable";
  const dotClass =
    status === "ready"
      ? "bg-green-500 shadow-[0_0_0_3px_rgba(34,197,94,0.18)] animate-pulse"
      : status === "checking"
      ? "bg-amber-500 animate-pulse"
      : "bg-destructive";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
          Agent integrations
        </p>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className={`h-2 w-2 rounded-full ${dotClass}`} aria-hidden />
          {statusLabel}
        </span>
      </div>
      {AGENTS.map((a) => (
        <button
          key={a.name}
          type="button"
          disabled={busy === a.name || status === "unavailable"}
          onClick={() => connect(a.name, a.connectorsUrl)}
          className="w-full flex items-center gap-3 rounded-md border border-border/60 bg-card px-4 py-3 text-left hover:bg-muted transition-colors disabled:opacity-60"
        >
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
            {busy === a.name ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            ) : (
              <Plug className="h-5 w-5 text-primary" />
            )}
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card ${dotClass}`}
              aria-hidden
            />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-semibold">{a.name}</span>
            <span className="block text-xs text-muted-foreground">
              {status === "ready"
                ? "Connect with Mera Rashan"
                : status === "checking"
                ? "Checking connection…"
                : "Connection unavailable"}
            </span>
          </span>
          <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
        </button>
      ))}
    </div>
  );
}
