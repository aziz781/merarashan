import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    // Reused secret name — value should be a Twilio Messaging Service SID (MG...)
    const MSG_SERVICE_SID = Deno.env.get("TWILIO_VERIFY_SERVICE_SID");
    const DEV_SKIP_SMS = Deno.env.get("DEV_SKIP_SMS") === "true";
    if (!DEV_SKIP_SMS && (!LOVABLE_API_KEY || !TWILIO_API_KEY || !MSG_SERVICE_SID)) {
      throw new Error("Twilio is not configured");
    }

    const { mobile } = await req.json();
    let cleaned = String(mobile ?? "").replace(/\D/g, "");
    // Default to Pakistan country code (92) for local-format numbers
    // like "03030812222" (11 digits starting with 0) or "3030812222" (10 digits).
    if (cleaned.length === 11 && cleaned.startsWith("0")) {
      cleaned = "92" + cleaned.slice(1);
    } else if (cleaned.length === 10 && cleaned.startsWith("3")) {
      cleaned = "92" + cleaned;
    }
    // Require an international format: 10-15 digits with a plausible country code.
    // E.164 allows 8-15 digits total; we require at least 10 to filter out
    // obviously-local numbers that Twilio will reject (e.g. "6504992804").
    if (cleaned.length < 10 || cleaned.length > 15) {
      return new Response(
        JSON.stringify({ error: "Invalid mobile number. Please include your country code (e.g. 92 for Pakistan)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const to = `+${cleaned}`;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Rate limit: max 3 sends per mobile per 10 minutes
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("otp_codes")
      .select("id", { count: "exact", head: true })
      .eq("mobile", cleaned)
      .gte("created_at", tenMinAgo);
    if ((count ?? 0) >= 3) {
      return new Response(JSON.stringify({ error: "Too many requests. Try again in a few minutes." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await sha256(code);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    if (DEV_SKIP_SMS) {
      console.log(`[DEV_SKIP_SMS] OTP for ${cleaned}: ${code}`);
    } else {
      const res = await fetch(`${GATEWAY_URL}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": TWILIO_API_KEY!,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: to,
          MessagingServiceSid: MSG_SERVICE_SID!,
          Body: `Your Mera Rashan App verification code is ${code}. It expires in 5 minutes.`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("Twilio send error", res.status, data);
        // Twilio code 21211 = invalid 'To' number. Surface as a 400 with a
        // friendly message so the client can guide the user to fix it, and
        // do NOT insert an OTP row (preserves rate limit).
        const twilioCode = (data as { code?: number })?.code;
        if (res.status === 400 || twilioCode === 21211 || twilioCode === 21614) {
          return new Response(
            JSON.stringify({ error: "Invalid mobile number. Please include your country code (e.g. 92 for Pakistan)." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        throw new Error((data as { message?: string })?.message || "Failed to send SMS");
      }
    }

    // Only persist the OTP after we know SMS delivery (or dev bypass) succeeded,
    // so failed sends don't consume the per-number rate limit.
    const { error: insertErr } = await supabase.from("otp_codes").insert({
      mobile: cleaned,
      code_hash: codeHash,
      expires_at: expiresAt,
    });
    if (insertErr) throw new Error(insertErr.message);

    // Also notify merarashan OTP endpoint (non-blocking on failure)
    try {
      const merarashanToken = Deno.env.get("MERARASHAN_API_TOKEN");
      const otpUrl = new URL("https://data.merarashan.pk/otp");
      otpUrl.searchParams.set("mobile", cleaned);
      otpUrl.searchParams.set("otp", code);
      const otpRes = await fetch(otpUrl.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...(merarashanToken ? { "x-api-key": merarashanToken } : {}),
        },
      });
      if (!otpRes.ok) {
        const t = await otpRes.text();
        console.error("merarashan /otp error", otpRes.status, t);
      }
    } catch (e) {
      console.error("merarashan /otp call failed", e instanceof Error ? e.message : e);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("send-otp:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
