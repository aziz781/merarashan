export type Resource = "cards" | "transactions" | "customers" | "statements";

export async function fetchResource<T = unknown>(
  resource: Resource,
  mobile: string,
  params?: Record<string, string | undefined>,
): Promise<T> {
  const url = new URL(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/merarashan-proxy`,
  );
  url.searchParams.set("resource", resource);
  url.searchParams.set("mobile", mobile);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v) url.searchParams.set(k, v);
    }
  }

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

export function formatMobile(input: string): string {
  return input.replace(/\D/g, "");
}
