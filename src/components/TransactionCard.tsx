import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Txn = Record<string, unknown>;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatMonthYear(input: string): string {
  if (!input) return "";
  const d = new Date(input);
  if (!isNaN(d.getTime())) {
    return `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
  }
  const m = input.match(/^(\d{4})-(\d{2})/);
  if (m) {
    const idx = Number(m[2]) - 1;
    return `${MONTHS[idx] ?? m[2]} ${m[1].slice(-2)}`;
  }
  return input;
}

export function TransactionCard({ item }: { item: Txn }) {
  const code = (item.unique_code as string) || "—";
  const amount = Number(item.amount ?? item.totalAmount) || 0;
  const status = (item.things_status as string) || "";
  const when = formatMonthYear((item.confirm_datetime as string) || "");

  const delivered = status === "Delivered";

  return (
    <Card className="p-4 bg-card/80 backdrop-blur shadow-[var(--shadow-soft)] border-border/50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {when && (
            <p className="text-sm font-bold text-foreground">{when}</p>
          )}
          <p className="text-xs text-muted-foreground font-mono break-all mt-1.5">
            {code}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <p className="font-bold text-foreground">
            Rs. {amount.toLocaleString("en-PK")}
          </p>
          {status && (
            <Badge
              variant={delivered ? "default" : "outline"}
              className="font-normal"
            >
              {status}
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
}
