import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

function normalize(m: string): string {
  return String(m || "").replace(/\D/g, "");
}

export function getAdminMobiles(): Set<string> {
  const raw = Deno.env.get("ADMIN_MOBILES") || "";
  return new Set(raw.split(",").map((s) => normalize(s)).filter(Boolean));
}

/**
 * Verifies the request bearer token, fetches the user, and returns their
 * mobile (from user_metadata) if they are in the admin allowlist.
 * Throws on any failure.
 */
export async function requireAdmin(req: Request): Promise<{ userId: string; mobile: string }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }
  const token = authHeader.replace("Bearer ", "");

  const anon = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!
  );
  const { data: claimsData, error: claimsErr } = await anon.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims?.sub) {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }
  const userId = claimsData.claims.sub as string;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const { data: userData, error: userErr } = await admin.auth.admin.getUserById(userId);
  if (userErr || !userData?.user) {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }
  const meta = (userData.user.user_metadata || {}) as { mobile?: string };
  const mobile = normalize(meta.mobile || "");

  const allow = getAdminMobiles();
  if (!mobile || !allow.has(mobile)) {
    throw Object.assign(new Error("Forbidden: not an admin"), { status: 403 });
  }
  return { userId, mobile };
}

export function unauthorizedResponse(e: unknown): Response {
  const err = e as { status?: number; message?: string };
  const status = err?.status === 403 ? 403 : 401;
  const message = err?.message || (status === 403 ? "Forbidden" : "Unauthorized");
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
