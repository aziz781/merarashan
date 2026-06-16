import { useEffect, useState } from "react";
import { fetchResource } from "@/lib/api";
import { extractItems } from "@/lib/itemUtils";

export function useTransactions(mobile: string, params?: Record<string, string>) {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [raw, setRaw] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const paramsKey = JSON.stringify(params ?? {});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchResource("transactions", mobile, params)
      .then((d) => {
        if (cancelled) return;
        const list = (extractItems(d) ?? []) as Record<string, unknown>[];
        setItems(list);
        setRaw((d as Record<string, unknown>) ?? null);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobile, paramsKey]);

  return { items, raw, loading, error };
}
