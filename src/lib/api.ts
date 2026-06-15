import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { queryClient } from "./queryClient";

export type Resource = "cards" | "transactions" | "customers" | "statements";

function buildUrl(
  resource: Resource,
  mobile: string,
  params?: Record<string, string | undefined>,
): string {
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
  return url.toString();
}

async function rawFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
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

export function resourceQueryKey(
  resource: Resource,
  mobile: string,
  params?: Record<string, string | undefined>,
) {
  const cleaned: Record<string, string> = {};
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v) cleaned[k] = v;
    }
  }
  return ["merarashan", resource, mobile, cleaned] as const;
}

/**
 * Imperative fetch — now backed by the shared React Query cache.
 * Identical concurrent calls are deduped; repeat calls within the
 * configured staleTime return the cached value without a network hit.
 */
export async function fetchResource<T = unknown>(
  resource: Resource,
  mobile: string,
  params?: Record<string, string | undefined>,
): Promise<T> {
  const url = buildUrl(resource, mobile, params);
  return queryClient.fetchQuery<T>({
    queryKey: resourceQueryKey(resource, mobile, params),
    queryFn: () => rawFetch<T>(url),
  });
}

/** Hook variant for new code — gets loading/error states for free. */
export function useResource<T = unknown>(
  resource: Resource,
  mobile: string | undefined,
  params?: Record<string, string | undefined>,
  options?: Omit<UseQueryOptions<T, Error>, "queryKey" | "queryFn">,
) {
  return useQuery<T, Error>({
    queryKey: resourceQueryKey(resource, mobile ?? "", params),
    queryFn: () => rawFetch<T>(buildUrl(resource, mobile!, params)),
    enabled: !!mobile && (options?.enabled ?? true),
    ...options,
  });
}

/** Manually invalidate cached resource data (e.g. after a mutation / pull-to-refresh). */
export function invalidateResource(
  resource?: Resource,
  mobile?: string,
) {
  const key: (string | undefined)[] = ["merarashan"];
  if (resource) key.push(resource);
  if (mobile) key.push(mobile);
  return queryClient.invalidateQueries({ queryKey: key });
}

export function formatMobile(input: string): string {
  return input.replace(/\D/g, "");
}
