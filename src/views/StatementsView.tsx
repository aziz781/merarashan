import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatementStats } from "@/components/StatementStats";
import { RecordCard } from "@/components/RecordCard";
import { fetchResource } from "@/lib/api";
import { extractItems } from "@/lib/itemUtils";

export function StatementsView({ mobile }: { mobile: string }) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => String(currentYear - i));
  const [selected, setSelected] = useState<string>(() => {
    try {
      const v = sessionStorage.getItem("statementsYear");
      if (v) return v;
    } catch (_) {
      /* ignore */
    }
    return String(currentYear);
  });
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    try {
      const v = sessionStorage.getItem("statementsStatus");
      if (v) return v;
    } catch (_) {
      /* ignore */
    }
    return "all";
  });
  useEffect(() => {
    try {
      sessionStorage.setItem("statementsYear", selected);
    } catch (_) {
      /* ignore */
    }
  }, [selected]);
  useEffect(() => {
    try {
      sessionStorage.setItem("statementsStatus", statusFilter);
    } catch (_) {
      /* ignore */
    }
  }, [statusFilter]);
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params: Record<string, string> = {};
    if (selected !== "all") params.year = selected;
    fetchResource("statements", mobile, params)
      .then((d) => {
        if (cancelled) return;
        setItems((extractItems(d) ?? []) as Record<string, unknown>[]);
        const s = (d as { stats?: Record<string, unknown> })?.stats ?? null;
        setStats(s);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [mobile, selected]);

  const filteredItems =
    statusFilter === "all"
      ? items
      : items.filter((i) => {
          const s = String(i.payment_status ?? "").toLowerCase();
          return statusFilter === "PAID" ? s === "paid" : s !== "paid";
        });

  return (
    <div className="space-y-3">
      <StatementStats items={items} stats={stats} activeStatus={statusFilter} onStatClick={setStatusFilter} />
      <div className="grid grid-cols-2 gap-3">
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="h-11">
            <SelectValue placeholder="Filter by year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All years</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={y}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-11">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="PAID">Paid</SelectItem>
            <SelectItem value="NOT_PAID">Unpaid</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {error ? (
        <Card className="p-5 border-destructive/30 bg-destructive/5">
          <p className="text-sm font-medium text-destructive mb-1">Failed to load</p>
          <p className="text-xs text-muted-foreground break-all">{error}</p>
        </Card>
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No statements found.</p>
      ) : (
        filteredItems.map((item, i) => <RecordCard key={i} resource="statements" mobile={mobile} item={item} />)
      )}
    </div>
  );
}
