import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Txn = Record<string, unknown>;

export function TransactionCard({
  item,
  variant = "full",
  origin = "home",
}: {
  item: Txn;
  variant?: "full" | "compact";
  origin?: "home" | "rashans";
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
        ? "text-muted-foreground"
        : "text-muted-foreground";

  const delivered = status === "Delivered";
  const notDelivered = status === "NOT_DELIVERED";
  const notPaid = paymentStatus === "NOT_PAID";
  const showExtras = variant === "full";

  const open = () => {
    const key = rcNum ? encodeURIComponent(rcNum) : "";
    try {
      sessionStorage.setItem("rashanDetailItem", JSON.stringify({ item, origin }));
      if (key) {
        sessionStorage.setItem(`rashanDetailItem:${rcNum}`, JSON.stringify({ item, origin }));
      }
    } catch (_) { /* ignore */ }
    navigate(key ? `/rashans/detail/${key}` : "/rashans/detail", { state: { item, origin } });
  };

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
            <p className={`text-xs mt-1 ${textClass}`}>{displayText}</p>
          )}
          {showExtras && rcNum && (
            <p className="text-[11px] text-muted-foreground font-mono break-all mt-1">
              {rcNum}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <p className={`font-bold ${paymentStatus !== "EXPIRED" && !notDelivered && notPaid ? "text-destructive" : "text-foreground"}`}>
            Rs. {amount.toLocaleString("en-PK")}
          </p>
          {status && (
            <Badge
              variant={
                paymentStatus === "EXPIRED"
                  ? "destructive"
                  : delivered
                    ? "default"
                    : notDelivered
                      ? "outline"
                      : notPaid
                        ? "destructive"
                        : "outline"
              }
              className={`font-normal inline-flex items-center gap-1 ${
                notDelivered && paymentStatus !== "EXPIRED"
                  ? "bg-yellow-300 text-red-600 border-yellow-400 hover:bg-yellow-300"
                  : ""
              }`}
            >
              {paymentStatus === "PAID" && <Check className="w-3 h-3" />}
              {paymentStatus === "EXPIRED" ? "EXPIRED" : status}
            </Badge>
          )}
          {showExtras && displayText && (
            <p className={`text-xs ${textClass}`}>{displayText}</p>
          )}
        </div>
      </div>
    </Card>
  );
}
