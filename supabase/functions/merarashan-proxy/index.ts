import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const BASE_URL = "https://data.merarashan.pk";
const ALLOWED = new Set(["cards", "transactions", "customers", "statements"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const token = Deno.env.get("MERARASHAN_API_TOKEN");
    if (!token) throw new Error("MERARASHAN_API_TOKEN not configured");

    const url = new URL(req.url);
    const resource = url.searchParams.get("resource") ?? "";
    const mobile = url.searchParams.get("mobile") ?? "";

    if (!ALLOWED.has(resource)) {
      return new Response(JSON.stringify({ error: "Invalid resource" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!/^\d{6,15}$/.test(mobile)) {
      return new Response(JSON.stringify({ error: "Invalid mobile number" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const upstream = await fetch(
      `${BASE_URL}/${resource}?mobile=${encodeURIComponent(mobile)}`,
      { headers: { "x-api-key": token, Accept: "application/json" } },
    );

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: {
        ...corsHeaders,
        "Content-Type": upstream.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
