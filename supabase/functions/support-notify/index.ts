// Notifies support agents (ADMIN_MOBILES) when a signed-in user sends a
// support message. Called by the user's app right after inserting a message.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { z } from "npm:zod";
import { getAdminMobiles } from "../_shared/admin.ts";
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
  normalizeB64Url(Deno.env.get("VAPID_PRIVATE_KEY")),
);

const BodySchema = z.object({
  conversation_id: z.string().uuid(),
  preview: z.string().max(300).optional(),
});

type WebSub = { mobile: string; endpoint: string; p256dh: string; auth: string };
type NativeSub = { mobile: string; fcm_token: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    // --- Validate the caller's JWT ---
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.slice("Bearer ".length);

    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data: claims, error: claimsErr } = await anon.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { conversation_id, preview } = parsed.data;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Conversation must belong to the caller.
    const { data: conv, error: convErr } = await admin
      .from("support_conversations")
      .select("id, user_id")
      .eq("id", conversation_id)
      .maybeSingle();
    if (convErr) throw convErr;
    if (!conv || conv.user_id !== userId) return json({ error: "Forbidden" }, 403);

    const { data: userData } = await admin.auth.admin.getUserById(userId);
    const senderMobile =
      ((userData?.user?.user_metadata || {}) as { mobile?: string }).mobile || "a customer";

    const adminMobiles = [...getAdminMobiles()];
    if (adminMobiles.length === 0) return json({ sent: 0, total: 0 });

    const title = `New support message from +${senderMobile}`;
    const body = (preview || "").slice(0, 160) || "Open the support dashboard to reply.";
    const url = "/admin/support";
    const tag = `support-${conversation_id}`;

    const [{ data: webSubs }, { data: natSubs }] = await Promise.all([
      admin.from("push_subscriptions").select("mobile, endpoint, p256dh, auth").in("mobile", adminMobiles),
      admin.from("native_push_subscriptions").select("mobile, fcm_token").in("mobile", adminMobiles),
    ]);

    const payload = JSON.stringify({ title, body, url, tag });
    const webResults = await Promise.allSettled(
      ((webSubs || []) as WebSub[]).map((s) =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        )
      ),
    );
    const staleWeb: string[] = [];
    webResults.forEach((r, i) => {
      if (r.status === "rejected") {
        const reason = r.reason as { statusCode?: number };
        if ([403, 404, 410].includes(reason?.statusCode || 0)) {
          staleWeb.push(((webSubs || []) as WebSub[])[i].endpoint);
        }
      }
    });
    if (staleWeb.length > 0) {
      await admin.from("push_subscriptions").delete().in("endpoint", staleWeb);
    }

    let nativeSent = 0;
    const staleFcm: string[] = [];
    const nat = (natSubs || []) as NativeSub[];
    if (nat.length > 0) {
      const results = await Promise.allSettled(
        nat.map((s) => fcmSend({ token: s.fcm_token, title, body, url, tag })),
      );
      results.forEach((r, i) => {
        if (r.status === "fulfilled") {
          if (r.value.ok) nativeSent++;
          else if (r.value.unregistered) staleFcm.push(nat[i].fcm_token);
        }
      });
      if (staleFcm.length > 0) {
        await admin.from("native_push_subscriptions").delete().in("fcm_token", staleFcm);
      }
    }

    // Store in the agents' in-app inbox so the badge survives a closed app.
    await admin.from("notification_inbox").insert(
      adminMobiles.map((m) => ({ mobile: m, title, body, url, tag })),
    );

    const webSent = webResults.filter((r) => r.status === "fulfilled").length;
    return json({ sent: webSent + nativeSent, total: (webSubs?.length || 0) + nat.length });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Server error" }, 500);
  }
});
