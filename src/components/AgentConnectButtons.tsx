import { useState } from "react";
import { ExternalLink, Loader2, Plug } from "lucide-react";
import { toast } from "sonner";

const MCP_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mcp`;

const AGENTS: { name: string; connectorsUrl: string }[] = [
  { name: "Claude", connectorsUrl: "https://claude.ai/settings/connectors" },
  { name: "ChatGPT", connectorsUrl: "https://chatgpt.com/#settings/Connectors" },
];

export function AgentConnectButtons() {
  const [busy, setBusy] = useState<string | null>(null);

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

  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold px-1">
        Agent integrations
      </p>
      {AGENTS.map((a) => (
        <button
          key={a.name}
          type="button"
          disabled={busy === a.name}
          onClick={() => connect(a.name, a.connectorsUrl)}
          className="w-full flex items-center gap-3 rounded-md border border-border/60 bg-card px-4 py-3 text-left hover:bg-muted transition-colors disabled:opacity-60"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
            {busy === a.name ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            ) : (
              <Plug className="h-5 w-5 text-primary" />
            )}
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-semibold">{a.name}</span>
            <span className="block text-xs text-muted-foreground">Connect with Mera Rashan</span>
          </span>
          <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
        </button>
      ))}
    </div>
  );
}
