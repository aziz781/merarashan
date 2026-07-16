import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Loader2, Plug } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const PROJECT_REF = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;
const MCP_URL = `${SUPABASE_URL}/functions/v1/mcp`;
const ISSUER = `https://${PROJECT_REF}.supabase.co/auth/v1`;

const AGENTS: { name: string; connectorsUrl: string }[] = [
  { name: "Claude", connectorsUrl: "https://claude.ai/settings/connectors" },
  { name: "ChatGPT", connectorsUrl: "https://chatgpt.com/#settings/Connectors" },
];

type CheckState = "checking" | "ok" | "fail";
type Checks = { session: CheckState; mcp: CheckState; issuer: CheckState };

const CHECK_META: Record<
  keyof Checks,
  { label: string; failHint: string }
> = {
  session: {
    label: "Sign-in session",
    failHint: "You're signed out. Sign in to Mera Rashan, then try again.",
  },
  mcp: {
    label: "MCP endpoint",
    failHint:
      "The MCP server is unreachable. Check your internet connection or try again in a moment.",
  },
  issuer: {
    label: "OAuth authorization server",
    failHint:
      "The OAuth server isn't responding. Check your connection or try again shortly.",
  },
};

export function AgentConnectButtons() {
  const [busy, setBusy] = useState<string | null>(null);
  const [checks, setChecks] = useState<Checks>({
    session: "checking",
    mcp: "checking",
    issuer: "checking",
  });

  const refresh = async () => {
    setChecks({ session: "checking", mcp: "checking", issuer: "checking" });
    const [sessionRes, mcpRes, issuerRes] = await Promise.all([
      supabase.auth.getSession().then(
        ({ data }) => (data.session ? "ok" : "fail") as CheckState,
        () => "fail" as CheckState,
      ),
      fetch(`${MCP_URL}/.well-known/oauth-protected-resource`, { cache: "no-store" })
        .then((r) => (r.ok ? "ok" : "fail") as CheckState)
        .catch(() => "fail" as CheckState),
      fetch(`${ISSUER}/.well-known/oauth-authorization-server`, { cache: "no-store" })
        .then((r) => (r.ok ? "ok" : "fail") as CheckState)
        .catch(() => "fail" as CheckState),
    ]);
    setChecks({ session: sessionRes, mcp: mcpRes, issuer: issuerRes });
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

  const values = Object.values(checks);
  const status: CheckState = values.includes("checking")
    ? "checking"
    : values.every((v) => v === "ok")
    ? "ok"
    : "fail";

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
    status === "ok" ? "Ready to connect" : status === "checking" ? "Checking…" : "Action needed";
  const dotClass =
    status === "ok"
      ? "bg-green-500 shadow-[0_0_0_3px_rgba(34,197,94,0.18)] animate-pulse"
      : status === "checking"
      ? "bg-amber-500 animate-pulse"
      : "bg-destructive";
  const subtitle =
    status === "ok"
      ? "Connect with Mera Rashan"
      : status === "checking"
      ? "Checking connection…"
      : "Tap the status dot for details";

  const failed = (Object.keys(checks) as (keyof Checks)[]).filter((k) => checks[k] === "fail");

  const tooltipContent = (
    <div className="max-w-[240px] space-y-2 text-xs">
      <p className="font-semibold">Connection checks</p>
      <ul className="space-y-1">
        {(Object.keys(checks) as (keyof Checks)[]).map((k) => {
          const s = checks[k];
          const color =
            s === "ok"
              ? "bg-green-500"
              : s === "checking"
              ? "bg-amber-500"
              : "bg-destructive";
          return (
            <li key={k} className="flex items-center gap-2">
              <span className={`h-1.5 w-1.5 rounded-full ${color}`} aria-hidden />
              <span className="flex-1">{CHECK_META[k].label}</span>
              <span className="opacity-70">
                {s === "ok" ? "OK" : s === "checking" ? "…" : "Failed"}
              </span>
            </li>
          );
        })}
      </ul>
      {failed.length > 0 && (
        <div className="pt-1 border-t border-border/40 space-y-1">
          {failed.map((k) => (
            <p key={k} className="opacity-90">
              <span className="font-medium">{CHECK_META[k].label}:</span> {CHECK_META[k].failHint}
            </p>
          ))}
        </div>
      )}
      {status === "ok" && (
        <p className="opacity-90">All checks passing. You can connect this agent.</p>
      )}
    </div>
  );

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
            Agent integrations
          </p>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground rounded px-1 -mr-1 hover:text-foreground"
                aria-label="Connection status details"
              >
                <span className={`h-2 w-2 rounded-full ${dotClass}`} aria-hidden />
                {statusLabel}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="end">
              {tooltipContent}
            </TooltipContent>
          </Tooltip>
        </div>
        {AGENTS.map((a) => (
          <div key={a.name} className="relative flex items-stretch gap-2">
            <button
              type="button"
              disabled={busy === a.name || status !== "ok"}
              onClick={() => connect(a.name, a.connectorsUrl)}
              className="flex-1 min-w-0 flex items-center gap-3 rounded-md border border-border/60 bg-card px-4 py-3 text-left hover:bg-muted transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                {busy === a.name ? (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                ) : (
                  <Plug className="h-5 w-5 text-primary" />
                )}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold">{a.name}</span>
                <span className="block text-xs text-muted-foreground">{subtitle}</span>
              </span>
              <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
            </button>
            <CopyMcpUrlButton agentName={a.name} />
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`${a.name} connection status: ${statusLabel}`}
                  className="absolute left-[38px] top-[30px] h-3.5 w-3.5 rounded-full border-2 border-card focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className={`block h-full w-full rounded-full ${dotClass}`} aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="start">
                {tooltipContent}
              </TooltipContent>
            </Tooltip>
          </div>
        ))}
      </div>
    </TooltipProvider>
  );
}
