import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BarChart3, TrendingUp, Wallet, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingState } from "@/components/LoadingState";
import { PageFooter } from "@/components/PageFooter";
import { useResourceItems } from "@/hooks/use-resource-items";
import { formatPKR, getItemDate } from "@/lib/itemUtils";
import type { Transaction } from "@/types/domain";
import { PageHeader } from "@/components/PageHeader";

const MOBILE_STORAGE_KEY = "mr_mobile";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function parseMonthIndex(item: Transaction): number | null {
  const my = String(item.month_year ?? "").toLowerCase();
  if (my) {
    // try "MM/YYYY" or "MM-YYYY"
    const mFull = my.match(/^(\d{1,2})[/-](\d{4})$/);
    if (mFull) return parseInt(mFull[1], 10) - 1;
    // try month name
    for (let i = 0; i < 12; i++) {
      const short = MONTHS[i].toLowerCase();
      const long = new Date(2000, i, 1)
        .toLocaleString("en-US", { month: "long" })
        .toLowerCase();
      if (my.includes(short) || my.includes(long)) return i;
    }
  }
  const d = getItemDate(item as Record<string, unknown>);
  if (!isNaN(d.getTime())) return d.getMonth();
  return null;
}

function itemYear(item: Transaction): number | null {
  const my = String(item.month_year ?? "");
  const yr = my.match(/(\d{4})/);
  if (yr) return parseInt(yr[1], 10);
  const d = getItemDate(item as Record<string, unknown>);
  if (!isNaN(d.getTime())) return d.getFullYear();
  return null;
}

export default function RashanDashboard() {
  const navigate = useNavigate();
  const [mobile, setMobile] = useState<string | null>(null);
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);

  useEffect(() => {
    try {
      setMobile(localStorage.getItem(MOBILE_STORAGE_KEY));
    } catch {
      setMobile(null);
    }
  }, []);

  const years = useMemo(
    () => Array.from({ length: 8 }, (_, i) => currentYear - i),
    [currentYear],
  );

  const { items, loading, error } = useResourceItems<Transaction>(
    "transactions",
    mobile ?? undefined,
    { monthYear: String(year) },
  );

  const monthly = useMemo(() => {
    const buckets = MONTHS.map((m, i) => ({
      month: m,
      monthIndex: i,
      amount: 0,
      count: 0,
      delivered: 0,
    }));
    for (const it of items) {
      const yr = itemYear(it);
      if (yr != null && yr !== year) continue;
      const mi = parseMonthIndex(it);
      if (mi == null) continue;
      const used = String(it.code_status ?? "").toUpperCase() === "USED";
      const amount = Number(it.amount) || 0;
      buckets[mi].count += 1;
      if (used) buckets[mi].amount += amount;
      if (String(it.things_status ?? "") === "Delivered") {
        buckets[mi].delivered += 1;
      }
    }
    return buckets;
  }, [items, year]);

  const totals = useMemo(() => {
    const amount = monthly.reduce((s, b) => s + b.amount, 0);
    const count = monthly.reduce((s, b) => s + b.count, 0);
    const delivered = monthly.reduce((s, b) => s + b.delivered, 0);
    const monthsWithSpend = monthly.filter((b) => b.amount > 0).length;
    const avg = monthsWithSpend > 0 ? amount / monthsWithSpend : 0;
    const peak = monthly.reduce(
      (best, b) => (b.amount > best.amount ? b : best),
      monthly[0],
    );
    return { amount, count, delivered, avg, peak };
  }, [monthly]);

  return (
    <div className="min-h-screen pb-24">
      <PageHeader>
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-tight truncate">
            Rashan Dashboard
          </h1>
          <p className="text-xs text-primary-foreground/80 mt-0.5">
            Monthly spending overview
          </p>
        </div>
      </PageHeader>

      <main className="px-5 pt-5 space-y-4">
        <Card className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Year</p>
              <p className="text-sm font-medium">Select a year to view</p>
            </div>
            <Select
              value={String(year)}
              onValueChange={(v) => setYear(parseInt(v, 10))}
            >
              <SelectTrigger className="h-10 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>

        {error ? (
          <Card className="p-5 border-destructive/30 bg-destructive/5">
            <p className="text-sm font-medium text-destructive mb-1">
              Failed to load
            </p>
            <p className="text-xs text-muted-foreground break-all">{error}</p>
          </Card>
        ) : loading ? (
          <LoadingState label="Loading dashboard..." />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatTile
                icon={Wallet}
                label="Total spent"
                value={formatPKR(totals.amount)}
              />
              <StatTile
                icon={BarChart3}
                label="Rashans"
                value={String(totals.count)}
              />
              <StatTile
                icon={CheckCircle2}
                label="Delivered"
                value={String(totals.delivered)}
              />
              <StatTile
                icon={TrendingUp}
                label="Avg / active month"
                value={formatPKR(Math.round(totals.avg))}
              />
            </div>

            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold">Spending per month</p>
                  <p className="text-xs text-muted-foreground">{year}</p>
                </div>
                {totals.peak && totals.peak.amount > 0 && (
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Peak
                    </p>
                    <p className="text-xs font-semibold">
                      {totals.peak.month} · {formatPKR(totals.peak.amount)}
                    </p>
                  </div>
                )}
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={monthly}
                    margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="month"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) =>
                        v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                      }
                    />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                      formatter={(v: number, name: string) =>
                        name === "amount"
                          ? [formatPKR(v), "Spent"]
                          : [v, name]
                      }
                    />
                    <Bar
                      dataKey="amount"
                      fill="hsl(var(--primary))"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-4">
              <p className="text-sm font-semibold mb-3">Monthly breakdown</p>
              <div className="divide-y divide-border/60">
                {monthly.map((b) => (
                  <div
                    key={b.month}
                    className="flex items-center justify-between py-2.5"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-8 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-semibold text-muted-foreground">
                        {b.month}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {b.count} rashan{b.count === 1 ? "" : "s"}
                        {b.delivered > 0 && ` · ${b.delivered} delivered`}
                      </span>
                    </div>
                    <span
                      className={`text-sm font-semibold ${
                        b.amount > 0 ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {b.amount > 0 ? formatPKR(b.amount) : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}
      </main>

      <button
        type="button"
        onClick={() => navigate(-1)}
        aria-label="Back"
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-1 ring-black/5 hover:opacity-90 transition"
        style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      <PageFooter />
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
}) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-[11px] uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-1.5 text-base font-bold leading-tight">{value}</p>
    </Card>
  );
}
