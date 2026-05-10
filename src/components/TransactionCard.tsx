import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Txn = Record<string, unknown>;

export function TransactionCard({
  item,
  variant = "full",
}: {
  item: Txn;
  variant?: "full" | "compact";
}) {
  const navigate = useNavigate();
  const amount = Number(item.amount ?? item.totalAmount) || 0;
  const status = (item.things_status as string) || "";
  const paymentStatus = (item.payment_status as string) || "";
  const userName = (item.code_user_name as string) || "";
  const rcNum = (item.rc_num as string) || "";
  const datetimeDisplay = (item.datetime_display as string) || "";
  const monthYear = (item.month_year as string) || "";
  const codeStatus = (item.code_status as string) || "";
  const displayText =
    codeStatus === "EXPIRED"
      ? "Rashan code expired"
      : codeStatus === "NEW"
        ? "Rashan code not used yet."
        : datetimeDisplay;
  const textClass =
    codeStatus === "EXPIRED"
      ? "text-destructive"
      : codeStatus === "NEW"
        ? "text-orange-500"
        : "text-muted-foreground";
    codeStatus === "EXPIRED"
      ? "text-destructive"
      : codeStatus === "NEW"
        ? "text-orange-500"
        : "text-muted-foreground";

  const delivered = status === "Delivered";
  const notPaid = paymentStatus === "NOT_PAID";
  const showExtras = variant === "full";

  const open = () => navigate("/rashans/detail", { state: { item } });

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
      className="p-4 bg-card/80 backdrop-blur shadow-[var(--shadow-soft)] border-border/50 cursor-pointer transition-transform hover:scale-[1.01] active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {showExtras && userName && (
            <p className="font-semibold text-foreground truncate">{userName}</p>
          )}
          {!showExtras && monthYear && (
            <p className="text-xs font-bold text-foreground">{monthYear}</p>
          )}
          {!showExtras && displayText && (
            <p className="text-xs text-muted-foreground mt-1">{displayText}</p>
          )}
          {showExtras && rcNum && (
            <p className="text-[11px] text-muted-foreground font-mono break-all mt-1">
              {rcNum}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <p className={`font-bold ${notPaid ? "text-destructive" : "text-foreground"}`}>
            Rs. {amount.toLocaleString("en-PK")}
          </p>
          {status && (
            <Badge
              variant={delivered ? "default" : notPaid ? "destructive" : "outline"}
              className="font-normal"
            >
              {status}
            </Badge>
          )}
          {showExtras && displayText && (
            <p className="text-xs text-muted-foreground">{displayText}</p>
          )}
        </div>
      </div>
    </Card>
  );
}
