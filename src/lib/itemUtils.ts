export function extractItems(data: unknown): unknown[] | null {
  if (Array.isArray(data)) return data;
  const d = data as { items?: unknown[]; data?: unknown[] };
  if (Array.isArray(d?.items)) return d.items;
  if (Array.isArray(d?.data)) return d.data;
  return null;
}

export function currentMonthParams() {
  const now = new Date();
  return {
    month: String(now.getMonth() + 1).padStart(2, "0"),
    year: String(now.getFullYear()),
  };
}

export function getItemDate(item: Record<string, unknown>): Date {
  const candidates = [
    item.created_at,
    item.date,
    item.txn_date,
    item.valid_from,
    item.payment_datetime,
    item.datetime_display,
    item.month_year,
  ];
  for (const c of candidates) {
    if (c == null || c === "") continue;
    const d = new Date(String(c));
    if (!isNaN(d.getTime())) return d;
  }
  return new Date(NaN);
}

export function isThisMonth(d: Date): boolean {
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export function isItemThisMonth(item: Record<string, unknown>): boolean {
  if (isThisMonth(getItemDate(item))) return true;
  const now = new Date();
  const yr = String(now.getFullYear());
  const short = now.toLocaleString("en-US", { month: "short" }).toLowerCase();
  const long = now.toLocaleString("en-US", { month: "long" }).toLowerCase();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const my = String(item.month_year ?? "").toLowerCase();
  if (!my) return false;
  if (!my.includes(yr)) return false;
  return (
    my.includes(short) ||
    my.includes(long) ||
    my.includes(`${mm}/`) ||
    my.includes(`-${mm}-`) ||
    my.includes(`/${mm}`)
  );
}
