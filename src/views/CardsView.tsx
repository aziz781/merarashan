import { useEffect, useState } from "react";
import { LayoutGrid, List } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RecordCard, CardGridTile } from "@/components/RecordCard";
import { LoadingState } from "@/components/LoadingState";
import type { Resource } from "@/lib/api";
import { getItemKey } from "@/lib/itemUtils";
import { useResourceItems } from "@/hooks/use-resource-items";
import type { Card as CardModel } from "@/types/domain";

const VIEW_KEY = "mr_cards_view";

function CardsList({ items, mobile }: { items: Record<string, unknown>[]; mobile: string }) {
  const [selected, setSelected] = useState<string>(() => {
    try {
      const v = sessionStorage.getItem("cardsFilter");
      if (v) return v;
    } catch (_) {
      /* ignore */
    }
    return "all";
  });
  useEffect(() => {
    try {
      sessionStorage.setItem("cardsFilter", selected);
    } catch (_) {
      /* ignore */
    }
  }, [selected]);
  const [view, setView] = useState<"list" | "grid">(() => {
    if (typeof window === "undefined") return "list";
    return (localStorage.getItem(VIEW_KEY) as "list" | "grid") || "list";
  });

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      // ignore
    }
  }, [view]);

  const names = Array.from(
    new Set(items.map((it) => String(it.person_name ?? "").trim()).filter((n) => n.length > 0)),
  ).sort();
  const filtered = selected === "all" ? items : items.filter((it) => String(it.person_name ?? "") === selected);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="h-11 flex-1">
            <SelectValue placeholder="Filter by name" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All names</SelectItem>
            {names.map((n) => (
              <SelectItem key={n} value={n}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="inline-flex h-11 rounded-md border border-input bg-background p-1 shrink-0">
          <button
            type="button"
            onClick={() => setView("list")}
            aria-label="List view"
            aria-pressed={view === "list"}
            className={`flex items-center justify-center w-9 rounded-sm transition-colors ${
              view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setView("grid")}
            aria-label="Grid view"
            aria-pressed={view === "grid"}
            className={`flex items-center justify-center w-9 rounded-sm transition-colors ${
              view === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No cards match the filter.</p>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((item, i) => (
            <CardGridTile key={getItemKey(item, i)} item={item} index={i + 1} />
          ))}
        </div>
      ) : (
        filtered.map((item, i) => (
          <RecordCard key={getItemKey(item, i)} resource="cards" item={item} index={i + 1} />
        ))
      )}
    </div>
  );
}

export function CardsView({ resource, mobile }: { resource: Resource; mobile: string }) {
  const { items, loading, error } = useResourceItems<CardModel>(resource, mobile);

  if (loading) {
    return <LoadingState label="Loading cards..." />;
  }

  if (error) {
    return (
      <Card className="p-5 border-destructive/30 bg-destructive/5">
        <p className="text-sm font-medium text-destructive mb-1">Failed to load</p>
        <p className="text-xs text-muted-foreground break-all">{error}</p>
      </Card>
    );
  }

  if (!items || items.length === 0) {
    return (
      <Card className="p-5">
        <p className="text-sm text-muted-foreground text-center">No records found.</p>
      </Card>
    );
  }

  if (resource === "cards") {
    return <CardsList items={items} mobile={mobile} />;
  }

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <RecordCard key={getItemKey(item, i)} resource={resource} item={item} />
      ))}
    </div>
  );
}
