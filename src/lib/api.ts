import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { queryClient } from "./queryClient";

export type Resource = "cards" | "transactions" | "customers" | "statements";

const MIN = 60 * 1000;
/**
 * Per-resource cache freshness windows. Cards/customers change rarely, so we
 * keep them fresh longer to avoid background refetches on tab switches.
 * Statements/transactions update more often (new month, new payment).
 */
const RESOURCE_STALE_TIME: Record<Resource, number> = {
  cards: 30 * MIN,
  customers: 30 * MIN,
  statements: 5 * MIN,
  transactions: 2 * MIN,
};

const RESOURCE_GC_TIME: Record<Resource, number> = {
  cards: 7 * 24 * 60 * MIN,
  customers: 7 * 24 * 60 * MIN,
  statements: 30 * 24 * 60 * MIN,
  transactions: 30 * 24 * 60 * MIN,
};

// Cache-buster bumped whenever we explicitly clear server-derived data
// (e.g. after a freeze/unfreeze mutation). Appended to outgoing URLs so
// the browser HTTP cache and the service-worker NetworkFirst layer can't
// return a stale snapshot from before the mutation.
let cacheBust = 0;

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
  if (cacheBust > 0) url.searchParams.set("_b", String(cacheBust));
  return url.toString();
}

export class ApiError extends Error {
  status: number;
  code?: "account_not_found";
  body?: string;
  constructor(message: string, status: number, body?: string, code?: "account_not_found") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
    this.code = code;
  }
}

function isAccountNotFound(status: number, body: string): boolean {
  if (status === 404) return true;
  if (status === 403 && /account does not exist|not found/i.test(body)) return true;
  return false;
}

async function rawFetch<T>(url: string): Promise<T> {
  const bypass = cacheBust > 0;
  const res = await fetch(url, {
    cache: bypass ? "no-store" : "default",
    headers: {
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
  });
  if (!res.ok) {
    const txt = await res.text();
    const code = isAccountNotFound(res.status, txt) ? "account_not_found" : undefined;
    throw new ApiError(`Request failed (${res.status}): ${txt}`, res.status, txt, code);
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
    staleTime: RESOURCE_STALE_TIME[resource],
    gcTime: RESOURCE_GC_TIME[resource],
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
  return queryClient.invalidateQueries({ queryKey: key, refetchType: "all" });
}

/** Force an immediate refetch of a specific resource (e.g. after freeze/unfreeze). */
export function refetchResource(
  resource: Resource,
  mobile: string,
  params?: Record<string, string | undefined>,
) {
  return queryClient.refetchQueries({
    queryKey: resourceQueryKey(resource, mobile, params),
    exact: true,
  });
}

/**
 * Clear all cached resource data (e.g. after account freeze/unfreeze).
 * Also bumps the cache-buster so the subsequent network refetch bypasses
 * the browser HTTP cache and the service-worker NetworkFirst layer that
 * would otherwise return the pre-mutation response for up to 60s.
 */
export function clearResourcesCache() {
  cacheBust += 1;
  queryClient.removeQueries({ queryKey: ["merarashan"] });
  return queryClient.invalidateQueries({ queryKey: ["merarashan"], refetchType: "all" });
}

/**
 * Wipe every app-scoped cache and persisted storage. Used on account deletion
 * so no customer data, tokens, or UI state survives after the session ends.
 */
export function clearAllAppCache() {
  // Bump the cache-buster so any in-flight or subsequent fetches bypass the
  // browser HTTP cache and the service-worker NetworkFirst layer.
  cacheBust += 1;

  // Wipe the entire React Query cache — not just the "merarashan" namespace —
  // so any ad-hoc keys (customers, profile lookups, admin queries, etc.) are
  // dropped along with the persisted snapshot.
  try {
    queryClient.cancelQueries();
  } catch { /* ignore */ }
  queryClient.removeQueries();
  queryClient.clear();

  if (typeof window === "undefined") return;

  try {
    // React Query persisted cache
    window.localStorage.removeItem("mr_rq_cache");

    // Known app keys
    const APP_KEYS = [
      "mr_mobile",
      "mr_payer_id",
      "mr_cards_view",
      "mr_theme",
      "mr_font_size",
      "mr_high_contrast",
      "mr_native_push_enabled",
      "mr_notifications_deleted_v1",
      "mr_notifications_v1",
      "mr_install_native_dismissed_at",
      "mr_chunk_reload",
    ];
    for (const key of APP_KEYS) {
      try { window.localStorage.removeItem(key); } catch { /* ignore */ }
    }

    // Catch any other mr_ prefixed keys that might have been added later
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const key = window.localStorage.key(i);
      if (key?.startsWith("mr_")) {
        try { window.localStorage.removeItem(key); } catch { /* ignore */ }
      }
    }
  } catch {
    // Private browsing or quota — best-effort cleanup.
  }
}


export function formatMobile(input: string): string {
  return input.replace(/\D/g, "");
}
