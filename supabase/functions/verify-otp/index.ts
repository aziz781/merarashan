import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { mobile, code } = await req.json();
    const cleaned = String(mobile ?? "").replace(/\D/g, "");
    const codeStr = String(code ?? "").trim();
    if (!/^\d{6}$/.test(codeStr)) {
      return new Response(JSON.stringify({ error: "Invalid code format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: rows, error } = await supabase
      .from("otp_codes")
      .select("id, code_hash, expires_at, attempts, consumed")
      .eq("mobile", cleaned)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);

    const row = rows?.[0];
    if (!row || row.consumed || new Date(row.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ error: "Code expired. Request a new one." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (row.attempts >= 5) {
      return new Response(JSON.stringify({ error: "Too many attempts. Request a new code." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const codeHash = await sha256(codeStr);
    if (codeHash !== row.code_hash) {
      await supabase.from("otp_codes").update({ attempts: row.attempts + 1 }).eq("id", row.id);
      return new Response(JSON.stringify({ error: "Incorrect code" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("otp_codes").update({ consumed: true }).eq("id", row.id);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("verify-otp:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
