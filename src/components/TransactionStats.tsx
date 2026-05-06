import { Card } from "@/components/ui/card";
import { Receipt, Wallet, CheckCircle2, Clock } from "lucide-react";

type Txn = Record<string, unknown>;

function formatPKR(n: number) {
  return `Rs. ${n.toLocaleString("en-PK")}`;
}

export function TransactionStats({ items }: { items: Txn[] }) {
  const total = items.length;
  const totalAmount = items.reduce(
    (s, i) => s + (Number(i.totalAmount) || 0),
    0,
  );
  const delivered = items.filter((i) => i.things_status === "Delivered").length;
  const pending = total - delivered;

  const stats = [
    { label: "Transactions", value: String(total), icon: Receipt },
    { label: "Total Amount", value: formatPKR(totalAmount), icon: Wallet },
    { label: "Delivered", value: String(delivered), icon: CheckCircle2 },
    { label: "Pending", value: String(pending), icon: Clock },
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
