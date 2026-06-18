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

const EMAIL_DOMAIN = "phone.merarashan.local";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { mobile, code } = await req.json();
    const cleaned = String(mobile ?? "").replace(/\D/g, "");
    const codeStr = String(code ?? "").trim();

    // Test account bypass: allow login without verifying the OTP.
    const BYPASS_MOBILES = new Set(["447525776781"]);
    const isBypass = BYPASS_MOBILES.has(cleaned);

    if (!isBypass && !/^\d{6}$/.test(codeStr)) {
      return new Response(JSON.stringify({ error: "Invalid code format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (isBypass) {
      const email = `${cleaned}@${EMAIL_DOMAIN}`;
      const { error: createErr } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { mobile: cleaned },
      });
      if (createErr && !/already|registered|exists/i.test(createErr.message)) {
        throw new Error(createErr.message);
      }
      const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email,
      });
      if (linkErr) throw new Error(linkErr.message);
      const tokenHash = (linkData as { properties?: { hashed_token?: string } })?.properties?.hashed_token;
      if (!tokenHash) throw new Error("Could not issue session token");
      return new Response(JSON.stringify({ ok: true, email, token_hash: tokenHash, bypass: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // Ensure a Supabase auth user exists for this mobile, then issue a
    // single-use magiclink token the client can exchange for a real session.
    const email = `${cleaned}@${EMAIL_DOMAIN}`;

    const { data: existing } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1,
      // listUsers doesn't support filtering by email directly in v2; we rely on
      // createUser idempotency below and ignore "already registered" errors.
    });
    void existing;

    const { error: createErr } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { mobile: cleaned },
    });
    if (createErr && !/already|registered|exists/i.test(createErr.message)) {
      throw new Error(createErr.message);
    }

    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkErr) throw new Error(linkErr.message);

    const tokenHash = (linkData as { properties?: { hashed_token?: string } })?.properties?.hashed_token;
    if (!tokenHash) throw new Error("Could not issue session token");

    return new Response(JSON.stringify({ ok: true, email, token_hash: tokenHash }), {
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
