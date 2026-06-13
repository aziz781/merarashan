import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { requireAdmin, unauthorizedResponse } from "../_shared/admin.ts";
import { fcmSend } from "../_shared/fcm.ts";

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

type WebSub = { mobile: string; endpoint: string; p256dh: string; auth: string };
type NativeSub = { mobile: string; fcm_token: string };

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

    // --- Fetch both web and native subscriptions ---
    let webQ = admin.from("push_subscriptions").select("mobile, endpoint, p256dh, auth");
    let natQ = admin.from("native_push_subscriptions").select("mobile, fcm_token");
    if (Array.isArray(mobiles) && mobiles.length > 0) {
      const list = mobiles.map(String);
      webQ = webQ.in("mobile", list);
      natQ = natQ.in("mobile", list);
    } else if (mobile) {
      webQ = webQ.eq("mobile", String(mobile));
      natQ = natQ.eq("mobile", String(mobile));
    }
    const [{ data: webSubs, error: webErr }, { data: natSubs, error: natErr }] =
      await Promise.all([webQ, natQ]);
    if (webErr) throw webErr;
    if (natErr) throw natErr;

    // --- Web push ---
    const payload = JSON.stringify({ title, body: msg || "", url: url || "/", icon, tag });
    const webResults = await Promise.allSettled(
      (webSubs as WebSub[]).map((s) =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        )
      )
    );
    const staleWeb: string[] = [];
    const storedMobiles = new Set<string>();
    webResults.forEach((r, i) => {
      const sub = (webSubs as WebSub[])[i];
      if (r.status === "fulfilled") storedMobiles.add(sub.mobile);
      if (r.status === "rejected") {
        const reason = r.reason as { statusCode?: number; body?: string };
        const status = reason?.statusCode;
        const b = reason?.body || "";
        if (status === 404 || status === 410 || status === 403 || b.includes("VapidPkHashMismatch")) {
          staleWeb.push(sub.endpoint);
        }
      }
    });
    if (staleWeb.length > 0) {
      await admin.from("push_subscriptions").delete().in("endpoint", staleWeb);
    }

    // --- Native (FCM) push ---
    let nativeSent = 0;
    const staleFcm: string[] = [];
    if ((natSubs as NativeSub[]).length > 0) {
      const fcmResults = await Promise.allSettled(
        (natSubs as NativeSub[]).map((s) =>
          fcmSend({ token: s.fcm_token, title, body: msg, url, tag })
        )
      );
      fcmResults.forEach((r, i) => {
        const sub = (natSubs as NativeSub[])[i];
        if (r.status === "fulfilled") {
          if (r.value.ok) {
            nativeSent++;
            storedMobiles.add(sub.mobile);
          } else if (r.value.unregistered) staleFcm.push(sub.fcm_token);
        }
      });
      if (staleFcm.length > 0) {
        await admin.from("native_push_subscriptions").delete().in("fcm_token", staleFcm);
      }
    }

    const webSent = webResults.filter((r) => r.status === "fulfilled").length;
    if (storedMobiles.size > 0) {
      const { error: inboxErr } = await admin.from("notification_inbox").insert(
        Array.from(storedMobiles).map((m) => ({
          mobile: m,
          title: String(title),
          body: msg ? String(msg) : "",
          url: url ? String(url) : "/",
          tag: tag ? String(tag) : null,
        }))
      );
      if (inboxErr) throw inboxErr;
    }
    return new Response(
      JSON.stringify({
        sent: webSent + nativeSent,
        total: webSubs.length + (natSubs as NativeSub[]).length,
        stored: storedMobiles.size,
        web: { sent: webSent, total: webSubs.length, removed: staleWeb.length },
        native: { sent: nativeSent, total: (natSubs as NativeSub[]).length, removed: staleFcm.length },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
