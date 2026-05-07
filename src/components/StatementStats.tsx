import { Card } from "@/components/ui/card";
import { FileText, Wallet, CheckCircle2, Clock } from "lucide-react";

type Stmt = Record<string, unknown>;

function formatPKR(n: number) {
  return `Rs. ${n.toLocaleString("en-PK")}`;
}

export function StatementStats({ items }: { items: Stmt[] }) {
  const total = items.length;
  const totalAmount = items.reduce(
    (s, i) => s + (Number(i.invoice_subtotal) || 0),
    0,
  );
  const paid = items.filter(
    (i) => String(i.payment_status ?? "").toLowerCase() === "paid",
  ).length;
  const unpaid = total - paid;

  const stats = [
    { label: "Statements", value: String(total), icon: FileText },
    { label: "Total Subtotal", value: formatPKR(totalAmount), icon: Wallet },
    { label: "Paid", value: String(paid), icon: CheckCircle2 },
    { label: "Unpaid", value: String(unpaid), icon: Clock },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 mb-4">
      {stats.map(({ label, value, icon: Icon }) => (
        <Card
          key={label}
          className="p-4 border-border/50 bg-card/80 backdrop-blur shadow-[var(--shadow-soft)]"
        >
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Icon className="w-4 h-4" />
            <span className="text-xs font-medium">{label}</span>
          </div>
          <p className="text-lg font-bold text-foreground truncate">{value}</p>
        </Card>
      ))}
    </div>
  );
}
