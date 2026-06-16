import { useEffect, useState } from "react";
import { CheckCircle2, X, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TransactionCard } from "@/components/TransactionCard";
import { MessageBox } from "@/components/MessageBox";
import { useResource, type Resource } from "@/lib/api";
import { extractItems, currentMonthParams, getItemDate, findValue, isTruthy, getItemKey } from "@/lib/itemUtils";
import { useTransactions } from "@/hooks/use-transactions";
import type { Customer } from "@/types/domain";

function StatTile({
  label,
  value,
  hint,
  onClick,
  loading,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  onClick?: () => void;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative w-full overflow-hidden rounded-2xl border border-border/50 bg-card/80 backdrop-blur shadow-[var(--shadow-soft)] p-4 text-left transition-transform hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{label}</p>
      <div className="mt-2 text-3xl font-bold text-foreground leading-none">
        {loading ? <Skeleton className="h-8 w-12" /> : value}
      </div>
      {hint && <p className="mt-1.5 text-[11px] text-muted-foreground">{hint}</p>}
    </button>
  );
}


function CurrentMonthTile({
  mobile,
  total,
  loading,
  onNavigate,
}: {
  mobile: string;
  total: number;
  loading: boolean;
  onNavigate?: (r: Resource) => void;
}) {
  const now = new Date();
  const monthLong = now.toLocaleString(undefined, { month: "long" });
  const monthShort = now.toLocaleString("en-US", { month: "short" });
  const year = String(now.getFullYear());
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchResource("statements", mobile, { year, month: monthShort })
      .then((d) => {
        if (cancelled) return;
        const items = (extractItems(d) ?? []) as Record<string, unknown>[];
        const s = items[0]?.payment_status;
        setPaymentStatus(s ? String(s) : null);
      })
      .catch(() => !cancelled && setPaymentStatus(null));
    return () => {
      cancelled = true;
    };
  }, [mobile, year, monthShort]);

  const isPaid = paymentStatus?.toUpperCase() === "PAID";
  const isUnpaid = paymentStatus?.toUpperCase() === "NOT_PAID";

  return (
    <StatTile
      label="Current Month"
      value={`Rs. ${total.toLocaleString("en-PK")}`}
      hint={
        <span className="inline-flex items-center gap-1.5">
          {(isPaid || isUnpaid) && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                try {
                  sessionStorage.setItem("statementsYear", year);
                } catch (_) {
                  /* ignore */
                }
                onNavigate?.("statements");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  try {
                    sessionStorage.setItem("statementsYear", year);
                  } catch (_) {
                    /* ignore */
                  }
                  onNavigate?.("statements");
                }
              }}
              className="inline-flex cursor-pointer"
              aria-label={isPaid ? "View paid statement" : "View unpaid statement"}
            >
              {isPaid ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              )}
            </span>
          )}
          Total rashan amount in {monthLong}
        </span>
      }
      loading={loading}
      onClick={() => {
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        try {
          sessionStorage.setItem(
            "rashanFilters",
            JSON.stringify({ status: "all", validFrom: `${mm}/${year}` }),
          );
        } catch (_) {
          /* ignore */
        }
        onNavigate?.("transactions");
      }}
    />
  );
}

function CurrentYearStat({
  mobile,
  onNavigate,
}: {
  mobile: string;
  onNavigate?: (r: Resource) => void;
}) {
  const year = String(new Date().getFullYear());
  const { raw, loading } = useTransactions(mobile, { monthYear: year });
  const total = findValue(raw, "totalTransactionAmount") ?? 0;
  return (
    <StatTile
      label="Current Year"
      value={`Rs. ${total.toLocaleString("en-PK")}`}
      hint={<>Total rashan amount in {year}</>}
      loading={loading}
      onClick={() => {
        try {
          sessionStorage.setItem(
            "rashanFilters",
            JSON.stringify({ status: "all", validFrom: year }),
          );
        } catch (_) {
          /* ignore */
        }
        onNavigate?.("transactions");
      }}
    />
  );
}

function CardsStats({
  activeCards,
  mobile,
  onNavigate,
}: {
  activeCards: React.ReactNode;
  mobile: string;
  onNavigate?: (r: Resource) => void;
}) {
  const { raw, loading } = useTransactions(mobile, currentMonthParams());
  const total = findValue(raw, "totalTransactionAmount") ?? 0;
  const cardsUsed = findValue(raw, "totalCardsUsed") ?? 0;

  const totalCards = Number(activeCards) || 0;
  const pending = Math.max(0, totalCards - Number(cardsUsed || 0));

  return (
    <div className="grid grid-cols-2 gap-3">
      <StatTile
        label={`Cards Used`}
        value={
          <span className="inline-flex items-center gap-2">
            {cardsUsed ?? "—"}
            {pending > 0 && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  const now = new Date();
                  const mm = String(now.getMonth() + 1).padStart(2, "0");
                  const yyyy = String(now.getFullYear());
                  try {
                    sessionStorage.setItem(
                      "rashanFilters",
                      JSON.stringify({ status: "NOT_DELIVERED", validFrom: `${mm}/${yyyy}` }),
                    );
                  } catch (_) {
                    /* ignore */
                  }
                  onNavigate?.("transactions");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    const now = new Date();
                    const mm = String(now.getMonth() + 1).padStart(2, "0");
                    const yyyy = String(now.getFullYear());
                    try {
                      sessionStorage.setItem(
                        "rashanFilters",
                        JSON.stringify({ status: "NOT_DELIVERED", validFrom: `${mm}/${yyyy}` }),
                      );
                    } catch (_) {
                      /* ignore */
                    }
                    onNavigate?.("transactions");
                  }
                }}
                className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-xs font-semibold cursor-pointer hover:bg-amber-200 transition-colors"
                title={`${pending} pending card${pending === 1 ? "" : "s"}`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                {pending}
              </span>
            )}
            {totalCards > 0 && pending === 0 && (
              <CheckCircle2 className="w-5 h-5 text-green-600" aria-label="All cards used" />
            )}
          </span>
        }
        hint={
          <>
            of {totalCards} Rashan cards in {new Date().toLocaleString(undefined, { month: "long" })}
          </>
        }
        onClick={() => {
          const now = new Date();
          const mm = String(now.getMonth() + 1).padStart(2, "0");
          const yyyy = String(now.getFullYear());
          try {
            sessionStorage.setItem(
              "rashanFilters",
              JSON.stringify({ status: "Delivered", validFrom: `${mm}/${yyyy}` }),
            );
          } catch (_) {
            /* ignore */
          }
          onNavigate?.("transactions");
        }}
      />

      <CurrentMonthTile mobile={mobile} total={total} loading={loading} onNavigate={onNavigate} />

      <div className="col-span-2">
        <CurrentYearStat mobile={mobile} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

function RecentRashans({
  mobile,
  onViewAll,
  totalCards,
}: {
  mobile: string;
  onViewAll?: () => void;
  totalCards?: number;
}) {
  const { items, raw, loading, error } = useTransactions(mobile, currentMonthParams());
  const cardsUsed = findValue(raw, "totalCardsUsed") ?? 0;

  const now = new Date();
  const monthLabel = now.toLocaleString(undefined, { month: "long" });

  const latest = [...items].sort((a, b) => getItemDate(b).getTime() - getItemDate(a).getTime()).slice(0, 3);

  return (
    <Card className="p-4 bg-card/80 backdrop-blur shadow-[var(--shadow-soft)] border-border/50">
      <div className="flex items-start justify-between mb-3 gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Recent Rashans</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">This month · {monthLabel}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center rounded-full bg-primary/10 text-primary text-xs font-semibold px-2 py-0.5">
            <span className="font-bold">{cardsUsed}</span>&nbsp;of {totalCards ?? 0} cards used
          </span>
          <button type="button" onClick={onViewAll} className="text-xs font-medium text-primary hover:underline">
            View all
          </button>
        </div>
      </div>
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <p className="text-xs text-destructive break-all">{error}</p>
      ) : latest.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-3">No rashans yet.</p>
      ) : (
        <div className="space-y-2">
          {latest.map((item, i) => (
            <TransactionCard key={getItemKey(item, i)} item={item} />
          ))}
        </div>
      )}
    </Card>
  );
}

export function ProfileView({
  mobile,
  onNavigate,
  profileOnly = false,
}: {
  mobile: string;
  onNavigate?: (r: Resource) => void;
  profileOnly?: boolean;
}) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissedMsg, setDismissedMsg] = useState<string | null>(() => {
    try { return sessionStorage.getItem("dismissedHomeMsg"); } catch { return null; }
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchResource("customers", mobile)
      .then((d) => {
        if (cancelled) return;
        const items = extractItems(d);
        const first = (items && items[0]) || d;
        setData(first as Record<string, unknown>);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [mobile]);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-2xl" />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <Card className="p-5 border-destructive/30 bg-destructive/5">
        <p className="text-sm font-medium text-destructive mb-1">Failed to load</p>
        <p className="text-xs text-muted-foreground break-all">{error}</p>
      </Card>
    );
  }
  if (!data) {
    return <p className="text-sm text-muted-foreground text-center py-6">No profile data.</p>;
  }

  const section1: { key: string; label: string }[] = [
    { key: "payer_id", label: "ID" },
    { key: "contact_person", label: "Name" },
    { key: "payer_contact_wa_number", label: "WhatsApp" },
    { key: "payer_joined_date", label: "Joined Date" },
    { key: "is_active", label: "Status" },
  ];

  const renderRow = ({ key, label }: { key: string; label: string }) => {
    const raw = data[key];
    let display: React.ReactNode;
    if (raw == null || raw === "") {
      display = "—";
    } else if (key === "is_active") {
      const isActive = isTruthy(raw);
      display = isActive ? (
        <span className="inline-flex items-center gap-1.5 font-medium">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          Active
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 font-medium">
          Inactive
          <X className="w-4 h-4 text-destructive" />
        </span>
      );
    } else if (key === "active_cards") {
      display = (
        <Badge variant="default" className="font-normal">
          {String(raw)}
        </Badge>
      );
    } else {
      display = String(raw);
    }
    return (
      <div key={key} className="flex justify-between gap-3 text-sm items-center">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground text-right break-all">{display}</span>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {profileOnly && (
        <Card className="p-4 bg-card/80 backdrop-blur shadow-[var(--shadow-soft)] border-border/50">
          <div className="space-y-1.5">{section1.map(renderRow)}</div>
        </Card>
      )}
      {!profileOnly && (
        <>
          <CardsStats
            activeCards={data.active_cards != null && data.active_cards !== "" ? String(data.active_cards) : "—"}
            mobile={mobile}
            onNavigate={onNavigate}
          />

          {data.msg != null && String(data.msg).trim() !== "" && dismissedMsg !== String(data.msg) && (
            <MessageBox
              type={String(data.msg_type ?? "")}
              title={data.msg_title ? String(data.msg_title) : undefined}
              message={String(data.msg)}
              onDismiss={() => {
                const m = String(data.msg);
                try { sessionStorage.setItem("dismissedHomeMsg", m); } catch {}
                setDismissedMsg(m);
              }}
            />
          )}

          <RecentRashans
            mobile={mobile}
            totalCards={Number(data.active_cards) || 0}
            onViewAll={() => onNavigate?.("transactions")}
          />
        </>
      )}
    </div>
  );
}
