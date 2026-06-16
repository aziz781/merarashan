import { useMemo } from "react";
import { useResource } from "@/lib/api";
import type { Resource } from "@/lib/api";
import { extractItems } from "@/lib/itemUtils";
import type { BaseRecord } from "@/types/domain";

/**
 * Wrapper around `useResource` that also extracts the list of items via
 * `extractItems`. Use this whenever a view needs both the raw envelope
 * (for stats / totals) and a typed list of records.
 *
 * Backed by React Query so identical requests are deduped & cached.
 */
export function useResourceItems<T extends BaseRecord = BaseRecord>(
  resource: Resource,
  mobile: string | undefined,
  params?: Record<string, string | undefined>,
) {
  const query = useResource<unknown>(resource, mobile, params);
  const items = useMemo<T[]>(
    () => (extractItems(query.data) ?? []) as T[],
    [query.data],
  );
  return {
    items,
    raw: (query.data ?? null) as Record<string, unknown> | null,
    loading: query.isPending && query.fetchStatus !== "idle",
    error: query.error ? query.error.message : null,
    refetch: query.refetch,
  };
}
