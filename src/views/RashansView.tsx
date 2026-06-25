import { useEffect, useMemo, useRef, useState } from "react";

import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { ArrowUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/LoadingState";
import { TransactionStats } from "@/components/TransactionStats";
import { TransactionCard } from "@/components/TransactionCard";
import { TransactionFilters, type TxnFilters } from "@/components/TransactionFilters";
import { getItemKey } from "@/lib/itemUtils";
import { useResourceItems } from "@/hooks/use-resource-items";
import type { Transaction } from "@/types/domain";

const TXN_VIRTUALIZE_THRESHOLD = 30;

function VirtualTransactionList({ items }: { items: Transaction[] }) {
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

function TransactionList({ items }: { items: Transaction[] }) {
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
  const { currentMonth, currentYear } = useMemo(() => {
    const now = new Date();
    return {
      currentMonth: String(now.getMonth() + 1).padStart(2, "0"),
      currentYear: String(now.getFullYear()),
    };
  }, []);
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

  const [statuses, setStatuses] = useState<string[]>([]);


  const params = useMemo<Record<string, string>>(() => {
    const p: Record<string, string> = {};
    const mFull = filters.validFrom.match(/^(\d{1,2})\/(\d{4})$/);
    const mYearOnly = filters.validFrom.match(/^(\d{4})$/);
    const mMonthOnly = filters.validFrom.match(/^(\d{1,2})$/);
    if (mFull) {
      p.monthYear = `${mFull[1].padStart(2, "0")}/${mFull[2]}`;
    } else if (mYearOnly) {
      p.monthYear = mYearOnly[1];
    } else if (mMonthOnly) {
      p.monthYear = `${mMonthOnly[1].padStart(2, "0")}/${currentYear}`;
    }
    return p;
  }, [filters.validFrom, currentYear]);

  const { items, raw, loading, error } = useResourceItems<Transaction>(
    "transactions",
    mobile,
    params,
  );

  const totalTransactionAmount = useMemo(() => {
    const tta = Number(
      (raw as Record<string, unknown>)?.totalTransactionAmount ??
        ((raw as Record<string, unknown>)?.data as Record<string, unknown>)?.totalTransactionAmount ??
        0,
    );
    return isNaN(tta) ? 0 : tta;
  }, [raw]);

  // Accumulate known statuses across fetches so the filter dropdown stays stable.
  useEffect(() => {
    if (items.length === 0) return;
    setStatuses((prev) => {
      const merged = new Set<string>(prev);
      for (const i of items) {
        const s = i.things_status as string;
        if (s) merged.add(s);
      }
      const next = Array.from(merged).sort();
      if (next.length === prev.length && next.every((s, idx) => s === prev[idx])) {
        return prev;
      }
      return next;
    });
  }, [items]);

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
    </>
  );
}

