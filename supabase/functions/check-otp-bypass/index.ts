import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { mobile } = await req.json();
    const cleaned = String(mobile ?? "").replace(/\D/g, "");
    if (!cleaned) {
      return new Response(JSON.stringify({ bypass: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase
      .from("otp_bypass_mobiles")
      .select("mobile")
      .eq("mobile", cleaned)
      .eq("active", true)
      .maybeSingle();
    if (error) throw new Error(error.message);

    return new Response(JSON.stringify({ bypass: !!data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("check-otp-bypass:", msg);
    return new Response(JSON.stringify({ bypass: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
