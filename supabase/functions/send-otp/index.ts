const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    const SERVICE_SID = Deno.env.get("TWILIO_VERIFY_SERVICE_SID");
    if (!LOVABLE_API_KEY || !TWILIO_API_KEY || !SERVICE_SID) {
      throw new Error("Missing Twilio configuration");
    }

    const { mobile } = await req.json();
    const cleaned = String(mobile ?? "").replace(/\D/g, "");
    if (cleaned.length < 6 || cleaned.length > 15) {
      return new Response(JSON.stringify({ error: "Invalid mobile number" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const to = cleaned.startsWith("+") ? cleaned : `+${cleaned}`;

    // Twilio Verify uses a different base path — call it directly via gateway
    const url = `https://connector-gateway.lovable.dev/twilio-verify/v2/Services/${SERVICE_SID}/Verifications`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, Channel: "sms" }),
    });
    const data = await res.json();
    if (!res.ok) {
      // Fallback: try the standard twilio gateway path with full Verify URL host
      const fallback = await fetch(
        `${GATEWAY_URL}/../twilio-verify/v2/Services/${SERVICE_SID}/Verifications`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": TWILIO_API_KEY,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ To: to, Channel: "sms" }),
        },
      );
      const fbData = await fallback.json();
      if (!fallback.ok) {
        console.error("Twilio Verify error", res.status, data, fallback.status, fbData);
        throw new Error(data?.message || fbData?.message || "Failed to send OTP");
      }
      return new Response(JSON.stringify({ status: fbData.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ status: data.status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("send-otp error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
