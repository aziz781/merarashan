import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { Card } from "@/components/ui/card";
import { LoadingState } from "@/components/LoadingState";
import { TransactionStats } from "@/components/TransactionStats";
import { TransactionCard } from "@/components/TransactionCard";
import { TransactionFilters, type TxnFilters } from "@/components/TransactionFilters";
import { fetchResource } from "@/lib/api";
import { extractItems, getItemKey } from "@/lib/itemUtils";

const TXN_VIRTUALIZE_THRESHOLD = 30;

function VirtualTransactionList({ items }: { items: Record<string, unknown>[] }) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const virtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize: () => 116,
    overscan: 6,
    scrollMargin: parentRef.current?.offsetTop ?? 0,
  });
  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();
  const offset = virtualItems[0]?.start ?? 0;

  return (
    <div ref={parentRef} style={{ position: "relative" }}>
      <div style={{ height: totalSize, position: "relative" }}>
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            transform: `translateY(${offset - (virtualizer.options.scrollMargin ?? 0)}px)`,
          }}
        >
          {virtualItems.map((v) => (
            <div
              key={v.key}
              data-index={v.index}
              ref={virtualizer.measureElement}
              style={{ paddingBottom: 12 }}
            >
              <TransactionCard item={items[v.index]} origin="rashans" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TransactionList({ items }: { items: Record<string, unknown>[] }) {
  if (items.length <= TXN_VIRTUALIZE_THRESHOLD) {
    return (
      <>
        {items.map((item, i) => (
          <TransactionCard key={getItemKey(item, i)} item={item} origin="rashans" />
        ))}
      </>
    );
  }
  return <VirtualTransactionList items={items} />;
}

export function RashansView({ mobile }: { mobile: string }) {
  const now = new Date();
  const currentMonth = String(now.getMonth() + 1).padStart(2, "0");
  const currentYear = String(now.getFullYear());
  const [filters, setFilters] = useState<TxnFilters>(() => {
    try {
      const saved = sessionStorage.getItem("rashanFilters");
      if (saved) return JSON.parse(saved) as TxnFilters;
    } catch (_) {
      /* ignore */
    }
    return { status: "all", validFrom: `${currentMonth}/${currentYear}` };
  });

  useEffect(() => {
    try {
      sessionStorage.setItem("rashanFilters", JSON.stringify(filters));
    } catch (_) {
      /* ignore */
    }
  }, [filters]);
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [totalTransactionAmount, setTotalTransactionAmount] = useState<number>(0);
  const [showBackToTop, setShowBackToTop] = useState<boolean>(false);

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params: Record<string, string> = {};
    const mFull = filters.validFrom.match(/^(\d{1,2})\/(\d{4})$/);
    const mYearOnly = filters.validFrom.match(/^(\d{4})$/);
    const mMonthOnly = filters.validFrom.match(/^(\d{1,2})$/);
    if (mFull) {
      params.monthYear = `${mFull[1].padStart(2, "0")}/${mFull[2]}`;
    } else if (mYearOnly) {
      params.monthYear = mYearOnly[1];
    } else if (mMonthOnly) {
      params.monthYear = `${mMonthOnly[1].padStart(2, "0")}/${currentYear}`;
    }

    fetchResource("transactions", mobile, params)
      .then((d) => {
        if (cancelled) return;
        const list = (extractItems(d) ?? []) as Record<string, unknown>[];
        setItems(list);
        const tta = Number(
          (d as Record<string, unknown>)?.totalTransactionAmount ??
            ((d as Record<string, unknown>)?.data as Record<string, unknown>)?.totalTransactionAmount ??
            0,
        );
        setTotalTransactionAmount(isNaN(tta) ? 0 : tta);
        setStatuses((prev) => {
          const merged = new Set<string>(prev);
          for (const i of list) {
            const s = i.things_status as string;
            if (s) merged.add(s);
          }
          return Array.from(merged).sort();
        });
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [mobile, filters.validFrom, currentYear]);

  const filtered = items.filter((i) => {
    if (filters.status !== "all" && i.things_status !== filters.status) return false;
    return true;
  });

  if (error) {
    return (
      <Card className="p-5 border-destructive/30 bg-destructive/5">
        <p className="text-sm font-medium text-destructive mb-1">Failed to load</p>
        <p className="text-xs text-muted-foreground break-all">{error}</p>
      </Card>
    );
  }

  return (
    <>
      <TransactionStats
        items={items}
        totalAmount={totalTransactionAmount}
        activeStatus={filters.status}
        onStatClick={(status) => setFilters((f) => ({ ...f, status }))}
      />
      <TransactionFilters statuses={statuses} value={filters} onChange={setFilters} />
      {loading ? (
        <LoadingState label="Loading rashans..." />
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No transactions match the filters.</p>
          ) : (
            <TransactionList items={filtered} />
          )}
        </div>
      )}
      {filtered.length > 8 && showBackToTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Back to top"
          className="fixed bottom-24 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-1 ring-primary/30 hover:bg-primary/90 transition-all animate-in fade-in slide-in-from-bottom-2"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      )}
    </>
  );
}
