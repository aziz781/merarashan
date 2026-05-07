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

export function TransactionCard({
  item,
  variant = "full",
}: {
  item: Txn;
  variant?: "full" | "compact";
}) {
  const code = (item.unique_code as string) || "—";
  const amount = Number(item.amount ?? item.totalAmount) || 0;
  const status = (item.things_status as string) || "";
  const when = formatMonthYear((item.confirm_datetime as string) || "");
  const confirmDatetime = (item.confirm_datetime as string) || "";
  const userName = (item.code_user_name as string) || "";
  const rcNum = (item.rc_num as string) || "";

  const delivered = status === "Delivered";
  const showExtras = variant === "full";

  return (
    <Card className="p-4 bg-card/80 backdrop-blur shadow-[var(--shadow-soft)] border-border/50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {showExtras && userName && (
            <p className="font-semibold text-foreground truncate">{userName}</p>
          )}
          {!showExtras && when && (
            <p className="text-sm font-bold text-foreground mt-0.5">{when}</p>
          )}
          <p className="text-xs text-muted-foreground font-mono break-all mt-1.5">
            {code}
          </p>
          {showExtras && rcNum && (
            <p className="text-[11px] text-muted-foreground font-mono break-all mt-1">
              {rcNum}
            </p>
          )}
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
          {showExtras && when && (
            <p className="text-xs font-semibold text-muted-foreground">{when}</p>
          )}
        </div>
      </div>
    </Card>
  );
}
