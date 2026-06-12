// Webhook called by the merarashan backend whenever a rashan's status changes.
// Authenticated via a shared secret in the X-Webhook-Secret header.
//
// Expected JSON body:
// {
//   "mobile": "447525776781",          // required — card owner's mobile
//   "title": "Rashan Available",       // required — notification title
//   "body":  "Your rashan ABC123 is now Available.",  // required — notification message
//   "rc_num": "ABC123",                // optional — included in data + used for default deep link
//   "status": "Available",             // optional — included in data payload
//   "previous_status": "Pending",      // optional — included in data payload
//   "url":   "/rashans/detail?rc=ABC123"               // optional deep link
// }

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { fcmSend } from "../_shared/fcm.ts";

const VAPID_PUBLIC_KEY =
  "BOHJmS8q7TDf9zry73X6aK1B7IVRqB2NTqvZCPPgCGeFNMRPQlxxFEOcgXW-TQraAIws6tU0oDOWdVEzTqZQ0qc";

function normSubject(raw: string | undefined): string {
  const v = (raw || "").trim();
  if (!v) return "mailto:admin@merarashan.pk";
  if (v.startsWith("mailto:") || v.startsWith("http://") || v.startsWith("https://")) return v;
  if (v.includes("@")) return `mailto:${v}`;
  return `https://${v}`;
}
function normB64(raw: string | undefined): string {
  return (raw || "").trim().replace(/\s+/g, "").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

webpush.setVapidDetails(
  normSubject(Deno.env.get("VAPID_SUBJECT")),
  VAPID_PUBLIC_KEY,
  normB64(Deno.env.get("VAPID_PRIVATE_KEY"))
);

type WebSub = { endpoint: string; p256dh: string; auth: string };
type NativeSub = { fcm_token: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // --- auth: shared secret ---
    const expected = Deno.env.get("MERARASHAN_WEBHOOK_SECRET");
    if (!expected) {
      return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const provided = req.headers.get("x-webhook-secret") || "";
    if (provided !== expected) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = (await req.json()) as {
      mobile?: string | number;
      rc_num?: string;
      status?: string;
      previous_status?: string;
      title?: string;
      body?: string;
      url?: string;
    };

    if (!payload?.mobile || !payload?.status) {
      return new Response(JSON.stringify({ error: "Missing required fields: mobile, status" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mobile = String(payload.mobile);
    const status = String(payload.status);
    const prev = payload.previous_status ? String(payload.previous_status) : undefined;
    const rc = payload.rc_num ? String(payload.rc_num) : undefined;

    const title = payload.title?.trim() || defaultTitle(status);
    const body = payload.body?.trim() || defaultBody(rc, status, prev);
    const url = payload.url?.trim() || (rc ? `/rashans/detail?rc=${encodeURIComponent(rc)}` : "/");
    const tag = rc ? `rashan-${rc}` : undefined;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const [{ data: webSubs, error: webErr }, { data: natSubs, error: natErr }] = await Promise.all([
      admin.from("push_subscriptions").select("endpoint, p256dh, auth").eq("mobile", mobile),
      admin.from("native_push_subscriptions").select("fcm_token").eq("mobile", mobile),
    ]);
    if (webErr) throw webErr;
    if (natErr) throw natErr;

    // --- web push ---
    const webPayload = JSON.stringify({ title, body, url, tag });
    const webResults = await Promise.allSettled(
      (webSubs as WebSub[]).map((s) =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          webPayload
        )
      )
    );
    const staleWeb: string[] = [];
    webResults.forEach((r, i) => {
      if (r.status === "rejected") {
        const reason = r.reason as { statusCode?: number; body?: string };
        const s = reason?.statusCode;
        const b = reason?.body || "";
        if (s === 404 || s === 410 || s === 403 || b.includes("VapidPkHashMismatch")) {
          staleWeb.push((webSubs as WebSub[])[i].endpoint);
        }
      }
    });
    if (staleWeb.length > 0) {
      await admin.from("push_subscriptions").delete().in("endpoint", staleWeb);
    }

    // --- native (FCM) ---
    let nativeSent = 0;
    const staleFcm: string[] = [];
    if ((natSubs as NativeSub[]).length > 0) {
      const data: Record<string, string> = { status };
      if (prev) data.previous_status = prev;
      if (rc) data.rc_num = rc;

      const fcmResults = await Promise.allSettled(
        (natSubs as NativeSub[]).map((s) =>
          fcmSend({ token: s.fcm_token, title, body, url, tag, data })
        )
      );
      fcmResults.forEach((r, i) => {
        if (r.status === "fulfilled") {
          if (r.value.ok) nativeSent++;
          else if (r.value.unregistered) staleFcm.push((natSubs as NativeSub[])[i].fcm_token);
        }
      });
      if (staleFcm.length > 0) {
        await admin.from("native_push_subscriptions").delete().in("fcm_token", staleFcm);
      }
    }

    const webSent = webResults.filter((r) => r.status === "fulfilled").length;
    return new Response(
      JSON.stringify({
        ok: true,
        mobile,
        web: { sent: webSent, total: (webSubs as WebSub[]).length, removed: staleWeb.length },
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
