import { supabase } from "@/integrations/supabase/client";

export type Resource = "cards" | "transactions" | "customers" | "statements";

export async function fetchResource<T = unknown>(
  resource: Resource,
  mobile: string,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke("merarashan-proxy", {
    method: "GET",
    // pass via query string by appending to the function name? invoke doesn't support query.
    // Use direct fetch instead.
  } as never);

  // Fallback: direct fetch with anon key.
  const url = new URL(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/merarashan-proxy`,
  );
  url.searchParams.set("resource", resource);
  url.searchParams.set("mobile", mobile);

  const res = await fetch(url.toString(), {
    headers: {
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Request failed (${res.status}): ${txt}`);
  }
  return res.json();
}
