import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import meraRashanLogo from "@/assets/mera-rashan-logo.webp";

// Typed shim for the beta `supabase.auth.oauth` namespace.
type OAuthClient = { name?: string; client_name?: string; redirect_uris?: string[] };
type AuthzDetails = {
  client?: OAuthClient;
  scope?: string;
  redirect_url?: string;
  redirect_to?: string;
};
type OAuthNs = {
  getAuthorizationDetails: (id: string) => Promise<{ data: AuthzDetails | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: AuthzDetails | null; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: AuthzDetails | null; error: { message: string } | null }>;
};
function oauthNs(): OAuthNs {
  return (supabase.auth as unknown as { oauth: OAuthNs }).oauth;
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<AuthzDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Missing authorization_id in the URL.");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.replace("/?next=" + encodeURIComponent(next));
        return;
      }
      try {
        const { data, error } = await oauthNs().getAuthorizationDetails(authorizationId);
        if (!active) return;
        if (error) {
          setError(error.message);
          return;
        }
        const immediate = data?.redirect_url ?? data?.redirect_to;
        if (immediate && !data?.client) {
          window.location.href = immediate;
          return;
        }
        setDetails(data);
      } catch (e) {
        if (active) setError((e as Error).message);
      }
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    try {
      const ns = oauthNs();
      const { data, error } = approve
        ? await ns.approveAuthorization(authorizationId)
        : await ns.denyAuthorization(authorizationId);
      if (error) {
        setBusy(false);
        setError(error.message);
        return;
      }
      const target = data?.redirect_url ?? data?.redirect_to;
      if (!target) {
        setBusy(false);
        setError("No redirect returned by the authorization server.");
        return;
      }
      window.location.href = target;
    } catch (e) {
      setBusy(false);
      setError((e as Error).message);
    }
  }

  const clientName = details?.client?.name ?? details?.client?.client_name ?? "an app";
  const scopeItems = (details?.scope ?? "").split(/\s+/).filter(Boolean);

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md p-6 space-y-5">
        <div className="flex flex-col items-center text-center space-y-3">
          <img src={meraRashanLogo} alt="Mera Rashan" className="h-12 w-auto" />
          <h1 className="text-xl font-semibold">
            Connect {clientName} to your Mera Rashan account
          </h1>
        </div>

        {error ? (
          <div className="text-sm text-destructive text-center">{error}</div>
        ) : !details ? (
          <div className="flex justify-center py-6">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground text-center">
              This lets {clientName} use Mera Rashan as you — reading your own
              rashan cards, statements, and transactions on your behalf.
            </p>
            {scopeItems.length > 0 && (
              <div className="text-xs text-muted-foreground text-center">
                Requested access: {scopeItems.join(", ")}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button variant="outline" disabled={busy} onClick={() => decide(false)}>
                Cancel
              </Button>
              <Button disabled={busy} onClick={() => decide(true)}>
                {busy ? "…" : "Approve"}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground text-center pt-1">
              This does not bypass Mera Rashan's permissions or backend policies.
            </p>
          </>
        )}
      </Card>
    </main>
  );
}
