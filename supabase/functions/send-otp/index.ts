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
    const cleaned = String(mobile ?? "").replace(/\D/g, "");
    if (cleaned.length < 6 || cleaned.length > 15) {
      return new Response(JSON.stringify({ error: "Invalid mobile number" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    const { error: insertErr } = await supabase.from("otp_codes").insert({
      mobile: cleaned,
      code_hash: codeHash,
      expires_at: expiresAt,
    });
    if (insertErr) throw new Error(insertErr.message);

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
      const data = await res.json();
      if (!res.ok) {
        console.error("Twilio send error", res.status, data);
        throw new Error(data?.message || "Failed to send SMS");
      }
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
