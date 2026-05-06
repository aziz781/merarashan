import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Txn = Record<string, unknown>;

export function TransactionCard({ item }: { item: Txn }) {
  const name = (item.code_user_name as string) || "—";
  const code = (item.unique_code as string) || "";
  const amount = Number(item.totalAmount) || 0;
  const method = (item.payment_method as string) || "";
  const status = (item.things_status as string) || "";
  const when = (item.confirm_datetime as string) || (item.created_date as string) || "";
  const rc = (item.rc_num as string) || "";

  const delivered = status === "Delivered";

  return (
    <Card className="p-4 bg-card/80 backdrop-blur shadow-[var(--shadow-soft)] border-border/50">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="font-semibold text-foreground truncate">{name}</p>
          <p className="text-xs text-muted-foreground font-mono">{code}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-bold text-foreground">
            Rs. {amount.toLocaleString("en-PK")}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {method && (
          <Badge variant="secondary" className="font-normal">
            {method}
          </Badge>
        )}
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

      {rc && (
        <p className="mt-2 text-[11px] text-muted-foreground font-mono">
          {rc}
        </p>
      )}
    </Card>
  );
}
