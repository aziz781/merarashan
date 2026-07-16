import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, XCircle, Loader2, Plug, Clock, Server, ShieldCheck, Copy, Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageFooter } from "@/components/PageFooter";
import { AgentConnectButtons } from "@/components/AgentConnectButtons";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const PROJECT_REF = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;
const MCP_URL = `${SUPABASE_URL}/functions/v1/mcp`;
const ISSUER = `https://${PROJECT_REF}.supabase.co/auth/v1`;

type Status = "checking" | "ok" | "fail";

function formatWhen(seconds: number | null | undefined): string {
  if (!seconds) return "—";
  const d = new Date(seconds * 1000);
  const now = Date.now();
  const diffMs = d.getTime() - now;
  const abs = Math.abs(diffMs);
  const mins = Math.round(abs / 60000);
  const hrs = Math.round(abs / 3600000);
  const days = Math.round(abs / 86400000);
  let rel: string;
  if (mins < 60) rel = `${mins} min`;
  else if (hrs < 48) rel = `${hrs} hr`;
  else rel = `${days} days`;
  const suffix = diffMs >= 0 ? `in ${rel}` : `${rel} ago`;
  return `${d.toLocaleString()} (${suffix})`;
}

const AgentIntegrations = () => {
  const navigate = useNavigate();
  const [sessionStatus, setSessionStatus] = useState<Status>("checking");
  const [email, setEmail] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [mcpStatus, setMcpStatus] = useState<Status>("checking");
  const [issuerStatus, setIssuerStatus] = useState<Status>("checking");
  const [registrationEndpoint, setRegistrationEndpoint] = useState<string | null>(null);

  const refreshStatuses = () => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSessionStatus("ok");
        setEmail(data.session.user.email ?? null);
        setExpiresAt(data.session.expires_at ?? null);
      } else {
        setSessionStatus("fail");
      }
    });

    setMcpStatus("checking");
    fetch(`${MCP_URL}/.well-known/oauth-protected-resource`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(() => setMcpStatus("ok"))
      .catch(() => setMcpStatus("fail"));

    setIssuerStatus("checking");
    fetch(`${ISSUER}/.well-known/oauth-authorization-server`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((meta) => {
        setIssuerStatus("ok");
        setRegistrationEndpoint(meta?.registration_endpoint ?? null);
      })
      .catch(() => setIssuerStatus("fail"));
  };

  useEffect(() => {
    refreshStatuses();
    const onFocus = () => refreshStatuses();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  useEffect(() => {
    const prevTitle = document.title;
    document.title = "AI Agent integrations — Mera Rashan";
    const desc = "Connect Mera Rashan to AI agents like Claude and ChatGPT via MCP. View live OAuth session and MCP server status.";
    let meta = document.querySelector('meta[name="description"]');
    const prevDesc = meta?.getAttribute("content") ?? null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", desc);
    return () => {
      document.title = prevTitle;
      if (prevDesc !== null) meta!.setAttribute("content", prevDesc);
    };
  }, []);


  const overallConnected = sessionStatus === "ok" && mcpStatus === "ok" && issuerStatus === "ok";

  return (
    <div className="min-h-screen pb-16">
      <header
        className="px-5 pt-10 pb-6 text-primary-foreground"
        style={{ background: "var(--gradient-primary)" }}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="text-primary-foreground hover:bg-white/10 -ml-2 mb-3"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <div className="flex items-center gap-3">
          <Plug className="w-6 h-6 opacity-90" />
          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate">AI Agent integrations</h1>
            <p className="text-xs opacity-80 truncate">MCP server status &amp; OAuth connection</p>
          </div>
        </div>
      </header>

      <main className="px-5 -mt-3 space-y-4">
        {/* Overall */}
        <Card className="p-4 bg-card/90 backdrop-blur shadow-[var(--shadow-soft)] border-border/50">
          <div className="flex items-center gap-3">
            <StatusIcon
              status={
                sessionStatus === "checking" || mcpStatus === "checking" || issuerStatus === "checking"
                  ? "checking"
                  : overallConnected
                  ? "ok"
                  : "fail"
              }
              size="lg"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                {overallConnected ? "Connected" : sessionStatus === "checking" ? "Checking…" : "Not fully connected"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {email ? `Signed in as ${email}` : "Sign in to enable agent access"}
              </p>
            </div>
          </div>
        </Card>

        {/* Session / OAuth expiry */}
        <Card className="p-4 bg-card/90 backdrop-blur shadow-[var(--shadow-soft)] border-border/50">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-primary" />
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
              OAuth session
            </h2>
          </div>
          <Row label="Status" value={<StatusBadge status={sessionStatus} okLabel="Active" failLabel="Signed out" />} />
          <Row label="User" value={<span className="font-mono text-xs">{email ?? "—"}</span>} />
          <Row
            label="Access token expires"
            value={<span className="text-xs">{formatWhen(expiresAt)}</span>}
          />
          <p className="mt-3 text-xs text-muted-foreground">
            The app auto-refreshes this token in the background. Agents connected via OAuth receive
            their own tokens with independent expiries.
          </p>
        </Card>

        {/* MCP endpoint */}
        <Card className="p-4 bg-card/90 backdrop-blur shadow-[var(--shadow-soft)] border-border/50">
          <div className="flex items-center gap-2 mb-3">
            <Server className="w-4 h-4 text-primary" />
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
              MCP server
            </h2>
          </div>
          <Row label="Status" value={<StatusBadge status={mcpStatus} okLabel="Reachable" failLabel="Unreachable" />} />
          <Row
            label="Endpoint"
            value={
              <code className="font-mono text-[11px] break-all text-foreground">{MCP_URL}</code>
            }
          />
          <Row label="Tools exposed" value={<Badge variant="outline" className="font-mono">5</Badge>} />
        </Card>

        {/* OAuth server */}
        <Card className="p-4 bg-card/90 backdrop-blur shadow-[var(--shadow-soft)] border-border/50">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
              OAuth authorization server
            </h2>
          </div>
          <Row label="Status" value={<StatusBadge status={issuerStatus} okLabel="Discoverable" failLabel="Unreachable" />} />
          <Row
            label="Issuer"
            value={
              <code className="font-mono text-[11px] break-all text-foreground">{ISSUER}</code>
            }
          />
          <Row
            label="Dynamic client registration"
            value={
              registrationEndpoint ? (
                <Badge className="font-mono">Enabled</Badge>
              ) : issuerStatus === "ok" ? (
                <Badge variant="outline" className="font-mono">Disabled</Badge>
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )
            }
          />
          <p className="mt-3 text-xs text-muted-foreground">
            Agents like ChatGPT, Claude, and Cursor use this server to sign you in and receive
            per-user access tokens for the MCP endpoint above.
          </p>
        </Card>

        {/* Connect your agent */}
        <Card className="p-4 bg-card/90 backdrop-blur shadow-[var(--shadow-soft)] border-border/50">
          <div className="flex items-center gap-2 mb-3">
            <Plug className="w-4 h-4 text-primary" />
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
              Connect your agent
            </h2>
          </div>

          <p className="text-xs text-muted-foreground mb-3">
            Copy this MCP server URL and paste it into your AI agent's connector settings. You'll
            sign in with your Mera Rashan mobile + OTP the first time.
          </p>

          <CopyRow value={MCP_URL} />

          <div className="mt-5 space-y-4">
            <AgentGuide
              name="Claude (claude.ai / Desktop)"
              badge="Recommended"
              mcpUrl={MCP_URL}
              connectorsUrl="https://claude.ai/settings/connectors"
              steps={[
                "Tap \"Connect with Mera Rashan\" below — the MCP URL is copied and Claude's Connectors page opens.",
                "In Claude, click \"Add custom connector\" and paste the URL.",
                "Click Connect — a tab opens Mera Rashan's sign-in and consent page.",
                "Approve access. Return here — status refreshes automatically.",
              ]}
            />

            <AgentGuide
              name="ChatGPT (Pro / Business / Enterprise)"
              mcpUrl={MCP_URL}
              connectorsUrl="https://chatgpt.com/#settings/Connectors"
              steps={[
                "Tap \"Connect with Mera Rashan\" below — the MCP URL is copied and ChatGPT's Connectors page opens.",
                "In ChatGPT → Connectors → Advanced, click \"Add\" and paste the URL.",
                "Choose OAuth — sign in with your mobile + OTP and approve.",
                "Enable the connector in a chat via the + menu → Connectors.",
              ]}
            />

          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            The agent only sees your own account data. You can revoke access anytime by removing
            the connector from your agent's settings.
          </p>
        </Card>
      </main>
      <PageFooter />

    </div>
  );
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm text-right min-w-0">{value}</span>
    </div>
  );
}

function StatusIcon({ status, size = "sm" }: { status: Status; size?: "sm" | "lg" }) {
  const cls = size === "lg" ? "w-8 h-8" : "w-4 h-4";
  if (status === "checking") return <Loader2 className={`${cls} animate-spin text-muted-foreground`} />;
  if (status === "ok") return <CheckCircle2 className={`${cls} text-green-600 dark:text-green-500`} />;
  return <XCircle className={`${cls} text-destructive`} />;
}

function StatusBadge({
  status,
  okLabel,
  failLabel,
}: {
  status: Status;
  okLabel: string;
  failLabel: string;
}) {
  if (status === "checking")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" /> Checking…
      </span>
    );
  if (status === "ok")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-500">
        <CheckCircle2 className="w-3.5 h-3.5" /> {okLabel}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive">
      <XCircle className="w-3.5 h-3.5" /> {failLabel}
    </span>
  );
}

function CopyRow({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("MCP URL copied");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Copy failed");
    }
  };
  return (
    <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/40 p-2">
      <code className="font-mono text-[11px] break-all flex-1 min-w-0">{value}</code>
      <Button size="sm" variant="secondary" className="shrink-0 h-8" onClick={onCopy}>
        {copied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

function AgentGuide({
  name,
  steps,
  mcpUrl,
  connectorsUrl,
  badge,
}: {
  name: string;
  steps: string[];
  mcpUrl: string;
  connectorsUrl: string;
  badge?: string;
}) {
  const [busy, setBusy] = useState(false);

  const connect = async () => {
    setBusy(true);
    try {
      try {
        await navigator.clipboard.writeText(mcpUrl);
        toast.success("MCP URL copied — paste it in the connector dialog", { duration: 5000 });
      } catch {
        toast.message("Copy the MCP URL manually and paste it in the connector dialog");
      }
      window.open(connectorsUrl, "_blank", "noopener,noreferrer");
    } finally {
      setTimeout(() => setBusy(false), 800);
    }
  };

  return (
    <div className="rounded-lg border border-border/50 p-3 bg-muted/20">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold">{name}</h3>
        {badge && <Badge className="text-[10px]">{badge}</Badge>}
      </div>
      <ol className="list-decimal ml-4 space-y-1 text-xs text-foreground/90">
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      <Button
        onClick={connect}
        disabled={busy}
        className="mt-3 w-full h-9"
        style={{ background: "var(--gradient-primary)" }}
      >
        {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plug className="w-4 h-4 mr-2" />}
        Connect with Mera Rashan
        <ExternalLink className="w-3.5 h-3.5 ml-2 opacity-80" />
      </Button>
    </div>
  );
}




export default AgentIntegrations;
