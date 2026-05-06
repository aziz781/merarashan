## Transactions page: stats + list

Add a stats panel above the transactions list showing aggregated insights, then keep the existing item list below.

### Stats to show (computed from the items array)

- **Total transactions** — count of items
- **Total amount** — sum of `totalAmount` (formatted as PKR)
- **Delivered** — count where `things_status === "Delivered"`
- **In progress / pending** — count of remaining

Displayed as a 2x2 grid of compact stat cards at the top of the Transactions tab.

### Per-item card improvements

The current generic RecordCard dumps every field. For transactions, render a focused card:
- Header: `code_user_name` + `unique_code`
- Amount badge: `totalAmount` PKR
- Sub-row: `payment_method` · `things_status` · `confirm_datetime`
- Small muted line: `rc_num`

### Implementation

- New component `src/components/TransactionStats.tsx` — receives items, computes & renders stats.
- New component `src/components/TransactionCard.tsx` — focused per-item card.
- Update `src/pages/Index.tsx`: when `resource === "transactions"`, render `<TransactionStats>` then the list using `TransactionCard` instead of generic `RecordCard`. Other tabs unchanged.
- Use existing semantic tokens (primary, muted, card) — no new colors.

No API or backend changes.