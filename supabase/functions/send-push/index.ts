import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { requireAdmin, unauthorizedResponse } from "../_shared/admin.ts";

const VAPID_PUBLIC_KEY =
  "BOHJmS8q7TDf9zry73X6aK1B7IVRqB2NTqvZCPPgCGeFNMRPQlxxFEOcgXW-TQraAIws6tU0oDOWdVEzTqZQ0qc";

function normalizeSubject(raw: string | undefined): string {
  const v = (raw || "").trim();
  if (!v) return "mailto:admin@merarashan.pk";
  if (v.startsWith("mailto:") || v.startsWith("http://") || v.startsWith("https://")) return v;
  if (v.includes("@")) return `mailto:${v}`;
  return `https://${v}`;
}

function normalizeB64Url(raw: string | undefined): string {
  return (raw || "").trim().replace(/\s+/g, "").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

webpush.setVapidDetails(
  normalizeSubject(Deno.env.get("VAPID_SUBJECT")),
  VAPID_PUBLIC_KEY,
  normalizeB64Url(Deno.env.get("VAPID_PRIVATE_KEY"))
);

type Sub = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    try {
      await requireAdmin(req);
    } catch (e) {
      return unauthorizedResponse(e);
    }

    const body = await req.json();
    const { mobile, mobiles, title, body: msg, url, icon, tag } = body || {};

    if (!title) {
      return new Response(JSON.stringify({ error: "Missing 'title'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let query = admin.from("push_subscriptions").select("endpoint, p256dh, auth");
    if (Array.isArray(mobiles) && mobiles.length > 0) {
      query = query.in("mobile", mobiles.map(String));
    } else if (mobile) {
      query = query.eq("mobile", String(mobile));
    }
    const { data: subs, error } = await query;
    if (error) throw error;

    const payload = JSON.stringify({ title, body: msg || "", url: url || "/", icon, tag });

    const results = await Promise.allSettled(
      (subs as Sub[]).map((s) =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        )
      )
    );

    // Cleanup gone/expired (404/410) and VAPID-mismatch (403, or Apple's 400
    // with VapidPkHashMismatch) subscriptions.
    const stale: string[] = [];
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        const reason = r.reason as { statusCode?: number; body?: string };
        const status = reason?.statusCode;
        const body = reason?.body || "";
        const vapidMismatch = body.includes("VapidPkHashMismatch");
        if (status === 404 || status === 410 || status === 403 || vapidMismatch) {
          stale.push(subs[i].endpoint);
        }
      }
    });
    if (stale.length > 0) {
      await admin.from("push_subscriptions").delete().in("endpoint", stale);
    }

    const sent = results.filter((r) => r.status === "fulfilled").length;
    return new Response(
      JSON.stringify({ sent, total: subs.length, removed: stale.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
