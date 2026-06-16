import { FileText, Wallet, CheckCircle2, Clock } from "lucide-react";
import { formatPKR } from "@/lib/itemUtils";
import { StatsGrid, type StatItem } from "@/components/StatsGrid";

type Stmt = Record<string, unknown>;

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

  const statsList: StatItem[] = [
    { label: "Statements", value: String(total), icon: FileText, status: "all" },
    { label: "Total Gross", value: formatPKR(totalAmount), icon: Wallet },
    { label: "Paid", value: String(paid), icon: CheckCircle2, status: "PAID" },
    { label: "Unpaid", value: String(unpaid), icon: Clock, status: "NOT_PAID" },
  ];

  return <StatsGrid stats={statsList} activeStatus={activeStatus} onStatClick={onStatClick} />;
}
