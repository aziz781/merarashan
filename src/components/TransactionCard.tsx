import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Txn = Record<string, unknown>;

function formatDate(input: string): string {
  if (!input) return "";
  // Try Date parse first
  const d = new Date(input);
  if (!isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }
  // Fallback: take first 10 chars if looks like yyyy-mm-dd
  const m = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return input;
}

export function TransactionCard({ item }: { item: Txn }) {
  const code = (item.unique_code as string) || "—";
  const amount = Number(item.amount ?? item.totalAmount) || 0;
  const status = (item.things_status as string) || "";
  const when = formatDate((item.confirm_datetime as string) || "");

  const delivered = status === "Delivered";

  return (
    <Card className="p-4 bg-card/80 backdrop-blur shadow-[var(--shadow-soft)] border-border/50">
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-xs text-muted-foreground font-mono break-all">{code}</p>
        <p className="font-bold text-foreground shrink-0">
          Rs. {amount.toLocaleString("en-PK")}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {status && (
          <Badge
            variant={delivered ? "default" : "outline"}
            className="font-normal"
          >
            {status}
          </Badge>
        )}
        {when && <span className="text-muted-foreground">{when}</span>}
      </div>
    </Card>
  );
}
