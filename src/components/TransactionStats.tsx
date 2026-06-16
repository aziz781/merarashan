import { Receipt, Wallet, CheckCircle2, Clock } from "lucide-react";
import { formatPKR } from "@/lib/itemUtils";
import { StatsGrid, type StatItem } from "@/components/StatsGrid";

type Txn = Record<string, unknown>;

export function TransactionStats({
  items,
  activeStatus,
  onStatClick,
}: {
  items: Txn[];
  totalAmount?: number;
  activeStatus?: string;
  onStatClick?: (status: string) => void;
}) {
  const total = items.length;
  const totalAmount = items.reduce(
    (s, i) => (i.code_status === "USED" ? s + (Number(i.amount) || 0) : s),
    0,
  );
  const delivered = items.filter((i) => i.things_status === "Delivered").length;
  const pending = total - delivered;

  const stats: StatItem[] = [
    { label: "Rashans", value: String(total), icon: Receipt, status: "all" },
    { label: "Total Amount", value: formatPKR(totalAmount), icon: Wallet },
    { label: "Delivered", value: String(delivered), icon: CheckCircle2, status: "Delivered" },
    { label: "Pending", value: String(pending), icon: Clock, status: "NOT_DELIVERED" },
  ];

  return <StatsGrid stats={stats} activeStatus={activeStatus} onStatClick={onStatClick} />;
}
