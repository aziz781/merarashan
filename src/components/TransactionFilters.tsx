import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";
import { useState } from "react";

export type TxnFilters = {
  status: string;
  validFrom: string;
};

export function TransactionFilters({
  statuses,
  value,
  onChange,
}: {
  statuses: string[];
  value: TxnFilters;
  onChange: (v: TxnFilters) => void;
}) {
  const hasFilter = value.status !== "all" || value.validFrom !== "";

  return (
    <div className="mb-4 p-3 rounded-2xl bg-card/80 backdrop-blur border border-border/50 shadow-[var(--shadow-soft)]">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select
            value={value.status}
            onValueChange={(v) => onChange({ ...value, status: v })}
          >
            <SelectTrigger className="h-10">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {statuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Valid from</Label>
          <Input
            type="text"
            inputMode="numeric"
            placeholder="MM/YYYY"
            value={value.validFrom}
            onChange={(e) => {
              let v = e.target.value.replace(/\D/g, "");
              if (v.length >= 2) v = v.slice(0, 2) + "/" + v.slice(2, 6);
              onChange({ ...value, validFrom: v });
            }}
            className="h-10"
          />
        </div>
      </div>
      {hasFilter && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 h-8 text-xs"
          onClick={() => onChange({ status: "all", validFrom: "" })}
        >
          <X className="w-3 h-3 mr-1" /> Clear filters
        </Button>
      )}
    </div>
  );
}
