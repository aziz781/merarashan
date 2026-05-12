import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { requireAdmin, unauthorizedResponse } from "../_shared/admin.ts";

const VAPID_PUBLIC_KEY =
  "BFOMGfHnkg6KuM_uPa6fNpz_C9XA9aUVf5ez1IGoJNr9ssEik2KtYg3Gc-t7DyzWfatqIaIPLxpiJCX_WbmMEWE";

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") || "mailto:admin@merarashan.pk",
  VAPID_PUBLIC_KEY,
  Deno.env.get("VAPID_PRIVATE_KEY")!
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

    // Cleanup gone/expired subscriptions (404/410).
    const stale: string[] = [];
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        const status = (r.reason as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) stale.push(subs[i].endpoint);
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
