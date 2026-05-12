import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireAdmin } from "../_shared/admin.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { mobile } = await requireAdmin(req);
    return new Response(JSON.stringify({ admin: true, mobile }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (_) {
    return new Response(JSON.stringify({ admin: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
