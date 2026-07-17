import { useMemo } from "react";
import { useResourceItems } from "@/hooks/use-resource-items";
import type { Statement, Transaction } from "@/types/domain";
import { getItemDate } from "@/lib/itemUtils";

interface Props {
  mobile: string;
}

/**
 * Small contextual pill shown next to the AI Assistant icon on the home
 * title bar. Derives a short hint from the user's latest statement and
 * recent transactions so the assistant feels aware of "what's new".
 *
 * Priority:
 *  1. Unpaid latest statement  → "Unpaid statement"
 *  2. New rashans this month   → "N new"
 *  3. Otherwise                → nothing (returns null)
 */
export function AssistantHintBadge({ mobile }: Props) {
  const { items: statements } = useResourceItems<Statement>("statements", mobile);
  const { items: transactions } = useResourceItems<Transaction>(
    "transactions",
    mobile,
    { monthYear: String(new Date().getFullYear()) },
  );

  const hint = useMemo(() => {
    // 1. Unpaid latest statement
    if (statements.length > 0) {
      const sorted = [...statements].sort((a, b) => {
        const da = getItemDate(a as Record<string, unknown>).getTime();
        const db = getItemDate(b as Record<string, unknown>).getTime();
        return db - da;
      });
      const latest = sorted[0];
      const status = String(latest?.payment_status ?? "").toLowerCase();
      if (status && status !== "paid" && status !== "cleared") {
        return { text: "Unpaid statement", tone: "warn" as const };
      }
    }

    // 2. New rashans this month
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const count = transactions.reduce((n, t) => {
      const d = getItemDate(t as Record<string, unknown>);
      if (isNaN(d.getTime())) return n;
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear ? n + 1 : n;
    }, 0);
    if (count > 0) {
      return { text: `${count} new`, tone: "info" as const };
    }

    return null;
  }, [statements, transactions]);

  if (!hint) return null;

  const toneClass =
    hint.tone === "warn"
      ? "bg-red-400/25 text-red-50 ring-red-300/40 dark:bg-red-500/20 dark:text-red-200 dark:ring-red-400/40"
      : "bg-white/20 text-primary-foreground ring-white/30 dark:bg-primary/25 dark:text-primary dark:ring-primary/50";

  return (
    <span
      aria-label={`AI Assistant hint: ${hint.text}`}
      className={`inline-flex max-w-[7.5rem] items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 truncate ${toneClass}`}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-80" />
      <span className="truncate">{hint.text}</span>
    </span>
  );
}
