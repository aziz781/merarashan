import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export type TxnFilters = {
  status: string;
  validFrom: string;
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function TransactionFilters({
  statuses,
  value,
  onChange,
}: {
  statuses: string[];
  value: TxnFilters;
  onChange: (v: TxnFilters) => void;
}) {
  const now = new Date();
  const currentYear = now.getFullYear();

  const parsedFull = value.validFrom.match(/^(\d{2})\/(\d{4})$/);
  const parsedYear = value.validFrom.match(/^(\d{4})$/);
  const selectedMonth = parsedFull ? parseInt(parsedFull[1], 10) : 0;
  const selectedYear = parsedFull
    ? parseInt(parsedFull[2], 10)
    : parsedYear
      ? parseInt(parsedYear[1], 10)
      : 0;

  const [open, setOpen] = useState(false);
  const [draftMonth, setDraftMonth] = useState<number>(selectedMonth || 0);
  const [draftYear, setDraftYear] = useState<number>(selectedYear || currentYear);

  const years = Array.from({ length: 8 }, (_, i) => currentYear - i);

  const apply = () => {
    if (draftMonth === 0) {
      onChange({ ...value, validFrom: `${draftYear}` });
    } else {
      const mm = String(draftMonth).padStart(2, "0");
      onChange({ ...value, validFrom: `${mm}/${draftYear}` });
    }
    setOpen(false);
  };

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
          <Label className="text-xs text-muted-foreground">Month/Year</Label>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "h-10 w-full justify-start font-normal",
                  !value.validFrom && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="w-4 h-4 mr-2" />
                {value.validFrom || "MM/YYYY"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-3 pointer-events-auto" align="start">
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Month</Label>
                  <div className="grid grid-cols-4 gap-1.5 mt-1.5">
                    {MONTHS.map((m, i) => {
                      const mNum = i + 1;
                      const active = mNum === draftMonth;
                      return (
                        <Button
                          key={m}
                          variant={active ? "default" : "outline"}
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => setDraftMonth(mNum)}
                        >
                          {m}
                        </Button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Year</Label>
                  <Select
                    value={String(draftYear)}
                    onValueChange={(v) => setDraftYear(parseInt(v, 10))}
                  >
                    <SelectTrigger className="h-9 mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((y) => (
                        <SelectItem key={y} value={String(y)}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      onChange({ ...value, validFrom: "" });
                      setOpen(false);
                    }}
                  >
                    Clear
                  </Button>
                  <Button size="sm" className="flex-1" onClick={apply}>
                    Apply
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}

