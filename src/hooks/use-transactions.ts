import { useResourceItems } from "@/hooks/use-resource-items";
import type { Transaction } from "@/types/domain";

/**
 * Thin compatibility wrapper around `useResourceItems('transactions', ...)`.
 * Kept so existing call sites don't need to change.
 */
export function useTransactions(mobile: string, params?: Record<string, string>) {
  return useResourceItems<Transaction>("transactions", mobile, params);
}
