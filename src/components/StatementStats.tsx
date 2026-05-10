import { Card } from "@/components/ui/card";
import { FileText, Wallet, CheckCircle2, Clock } from "lucide-react";

type Stmt = Record<string, unknown>;

function formatPKR(n: number) {
  return `Rs. ${n.toLocaleString("en-PK")}`;
}

export function StatementStats({
  items,
  stats,
  activeStatus,
  onStatClick,
}: {
  items: Stmt[];
  stats?: Record<string, unknown> | null;
  activeStatus?: string;
  onStatClick?: (status: string) => void;
}) {
  const total = items.length;
  const totalAmount =
    Number(stats?.totalGrossAmount) ||
    items.reduce((s, i) => s + (Number(i.invoice_total) || 0), 0);
  const paid = items.filter(
    (i) => String(i.payment_status ?? "").toLowerCase() === "paid",
  ).length;
  const unpaid = total - paid;

  const statsList = [
    { label: "Statements", value: String(total), icon: FileText, status: "all" },
    { label: "Total Gross", value: formatPKR(totalAmount), icon: Wallet },
    { label: "Paid", value: String(paid), icon: CheckCircle2, status: "PAID" },
    { label: "Unpaid", value: String(unpaid), icon: Clock, status: "NOT_PAID" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 mb-4">
      {statsList.map(({ label, value, icon: Icon, status }) => {
        const clickable = !!status && !!onStatClick;
        const active = clickable && activeStatus === status && status !== "all";
        return (
          <Card
            key={label}
            onClick={clickable ? () => onStatClick!(status!) : undefined}
            role={clickable ? "button" : undefined}
            tabIndex={clickable ? 0 : undefined}
            onKeyDown={
              clickable
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onStatClick!(status!);
                    }
                  }
                : undefined
            }
            className={`p-4 border-border/50 bg-card/80 backdrop-blur shadow-[var(--shadow-soft)] ${
              clickable ? "cursor-pointer transition-transform hover:scale-[1.01] active:scale-[0.99]" : ""
            } ${active ? "ring-2 ring-primary border-primary bg-primary/5" : ""}`}
          >
            <div className={`flex items-center gap-2 mb-1 ${active ? "text-primary" : "text-muted-foreground"}`}>
              <Icon className="w-4 h-4" />
              <span className="text-xs font-medium">{label}</span>
            </div>
            <p className="text-lg font-bold text-foreground truncate">{value}</p>
          </Card>
        );
      })}
    </div>
  );
}
