import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2,
  LogOut,
  CreditCard,
  ArrowLeftRight,
  ArrowLeft,
  User,
  FileText,
  Phone,
  FileDown,
  ExternalLink,
  Info,
  CheckCircle2,
  X,
  MessageCircle,
  Copy,
  AlertTriangle,
  LayoutGrid,
  List,
  Menu,
  Bell,
  BellOff,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { HelpCircle, ChevronDown, Bot, LifeBuoy, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { fetchResource, formatMobile, Resource } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import meraRashanLogo from "@/assets/mera-rashan-logo.webp";
import { TransactionStats } from "@/components/TransactionStats";
import { TransactionCard } from "@/components/TransactionCard";
import { TransactionFilters, type TxnFilters } from "@/components/TransactionFilters";
import { StatementStats } from "@/components/StatementStats";
import { PageFooter } from "@/components/PageFooter";
import { MessageBox } from "@/components/MessageBox";

import { NotificationToggle } from "@/components/NotificationToggle";
import { subscribeNotifications, syncNotificationInbox, unreadCount } from "@/lib/notificationsStore";
import { getCurrentSubscription, pushSupported } from "@/lib/push";
import { isNativePlatform } from "@/lib/nativePush";

const NATIVE_PUSH_ENABLED_KEY = "mr_native_push_enabled";

const STORAGE_KEY = "mr_mobile";
const PHONE_EMAIL_DOMAIN = "phone.merarashan.local";

// Lazy-load the login screen (and its zod schema) so unauthenticated-only
// code stays out of the main bundle for already-signed-in users.
const Login = lazy(() => import("./Login"));



function useLongPress(callback: () => void, duration = 600) {
  const timerRef = useRef<number | null>(null);
  const triggeredRef = useRef(false);

  const start = useCallback(() => {
    triggeredRef.current = false;
    timerRef.current = window.setTimeout(() => {
      triggeredRef.current = true;
      callback();
    }, duration);
  }, [callback, duration]);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const isTriggered = useCallback(() => {
    const t = triggeredRef.current;
    triggeredRef.current = false;
    return t;
  }, []);

  return { start, cancel, isTriggered };
}

function CardDetailsPopup({
  item,
  open,
  onOpenChange,
}: {
  item: Record<string, unknown> | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  if (!item) return null;

  const allowedKeys: { key: string; label: string }[] = [
    { key: "cm_card_number", label: "Card Number" },
    { key: "person_name", label: "Name" },
    { key: "amount", label: "Amount" },
    { key: "mobile_number", label: "Mobile" },
    { key: "city", label: "City" },
    { key: "reg_date", label: "Registration Date" },
  ];
  const entries = allowedKeys
    .map(({ key, label }) => [key, item[key], label] as const)
    .filter(([, v]) => v !== null && v !== "" && v !== undefined);

  const labelMap: Record<string, string> = Object.fromEntries(
    allowedKeys.map(({ key, label }) => [key, label]),
  );

  const formatValue = (key: string, raw: unknown): React.ReactNode => {
    if (raw == null || raw === "") return "—";
    if (key === "amount") {
      const n = Number(raw);
      return Number.isFinite(n) ? `Rs. ${n.toLocaleString("en-PK")}` : String(raw);
    }
    return String(raw);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2 pr-6">
            <span className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Card Details
            </span>
            <button
              type="button"
              aria-label="Copy all details"
              title="Copy all"
              onClick={async () => {
                const text = entries
                  .map(([key, value]) => `${labelMap[key] || key}: ${value ?? ""}`)
                  .join("\n");
                try {
                  if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
                  else {
                    const ta = document.createElement("textarea");
                    ta.value = text; document.body.appendChild(ta); ta.select();
                    document.execCommand("copy"); document.body.removeChild(ta);
                  }
                  toast({ title: "Copied all details" });
                } catch {
                  toast({ title: "Copy failed", variant: "destructive" });
                }
              }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <Copy className="w-4 h-4" />
              Copy all
            </button>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          {entries.map(([key, value], i) => {
            const hideLabel = key === "cm_card_number";
            return (
              <div key={key}>
                <div className="flex justify-between gap-3 text-sm items-start">
                  {!hideLabel && (
                    <span className="text-muted-foreground shrink-0">{labelMap[key] || key.replace(/_/g, " ")}</span>
                  )}
                  <span className={`font-medium text-foreground text-right break-all ${hideLabel ? "w-full" : ""}`}>{formatValue(key, value)}</span>
                </div>
                {i < entries.length - 1 && <Separator className="mt-3" />}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}


function ResourceView({
  resource,
  mobile,
  onNavigate,
}: {
  resource: Resource;
  mobile: string;
  onNavigate?: (r: Resource) => void;
}) {
  if (resource === "transactions") {
    return <RashansView mobile={mobile} />;
  }
  if (resource === "statements") {
    return <StatementsView mobile={mobile} />;
  }
  if (resource === "customers") {
    return <ProfileView mobile={mobile} onNavigate={onNavigate} />;
  }
  return <GenericResourceView resource={resource} mobile={mobile} />;
}

function useTransactions(mobile: string, params?: Record<string, string>) {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [raw, setRaw] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const paramsKey = JSON.stringify(params ?? {});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchResource("transactions", mobile, params)
      .then((d) => {
        if (cancelled) return;
        const list = (extractItems(d) ?? []) as Record<string, unknown>[];
        setItems(list);
        setRaw((d as Record<string, unknown>) ?? null);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobile, paramsKey]);

  return { items, raw, loading, error };
}

function currentMonthParams() {
  const now = new Date();
  return {
    month: String(now.getMonth() + 1).padStart(2, "0"),
    year: String(now.getFullYear()),
  };
}

function getItemDate(item: Record<string, unknown>): Date {
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

function isThisMonth(d: Date): boolean {
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function isItemThisMonth(item: Record<string, unknown>): boolean {
  if (isThisMonth(getItemDate(item))) return true;
  // Fallback: string match on month_year like "Jun 2026" / "June 2026" / "06/2026"
  const now = new Date();
  const yr = String(now.getFullYear());
  const short = now.toLocaleString("en-US", { month: "short" }).toLowerCase();
  const long = now.toLocaleString("en-US", { month: "long" }).toLowerCase();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const my = String(item.month_year ?? "").toLowerCase();
  if (!my) return false;
  if (!my.includes(yr)) return false;
  return (
    my.includes(short) || my.includes(long) || my.includes(`${mm}/`) || my.includes(`-${mm}-`) || my.includes(`/${mm}`)
  );
}

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
  const findKey = (obj: unknown, key: string): number | null => {
    if (!obj || typeof obj !== "object") return null;
    const o = obj as Record<string, unknown>;
    if (o[key] != null) return Number(o[key]) || 0;
    for (const v of Object.values(o)) {
      const r = findKey(v, key);
      if (r != null) return r;
    }
    return null;
  };
  const total = findKey(raw, "totalTransactionAmount") ?? 0;
  const cardsUsed = findKey(raw, "totalCardsUsed") ?? 0;

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
  const findKey = (obj: unknown, key: string): number | null => {
    if (!obj || typeof obj !== "object") return null;
    const o = obj as Record<string, unknown>;
    if (o[key] != null) return Number(o[key]) || 0;
    for (const v of Object.values(o)) {
      const r = findKey(v, key);
      if (r != null) return r;
    }
    return null;
  };
  const total = findKey(raw, "totalTransactionAmount") ?? 0;
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

  const findKey = (obj: unknown, key: string): number | null => {
    if (!obj || typeof obj !== "object") return null;
    const o = obj as Record<string, unknown>;
    if (o[key] != null) return Number(o[key]) || 0;
    for (const v of Object.values(o)) {
      const r = findKey(v, key);
      if (r != null) return r;
    }
    return null;
  };
  const cardsUsed = findKey(raw, "totalCardsUsed") ?? 0;

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
            <TransactionCard key={i} item={item} />
          ))}
        </div>
      )}
    </Card>
  );
}

function ProfileView({
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
  const section2: { key: string; label: string }[] = [
    { key: "card_name", label: "Card Type" },
    { key: "active_cards", label: "Active Cards" },
  ];

  const renderRow = ({ key, label }: { key: string; label: string }) => {
    const raw = data[key];
    let display: React.ReactNode;
    if (raw == null || raw === "") {
      display = "—";
    } else if (key === "is_active") {
      const isActive = raw === true || raw === "true" || raw === 1 || raw === "1";
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
        <>
          <Card className="p-4 bg-card/80 backdrop-blur shadow-[var(--shadow-soft)] border-border/50">
            <div className="space-y-1.5">{section1.map(renderRow)}</div>
          </Card>
        </>
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

function WhatsAppTile({
  href,
  number,
  title,
  subtitle,
}: {
  href: string;
  number: string;
  title: string;
  subtitle: string;
}) {
  const formatted = `+${number.slice(0, 2)} ${number.slice(2, 5)} ${number.slice(5, 8)} ${number.slice(8)}`;
  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(number);
      toast({ title: "Copied", description: `${formatted} copied to clipboard` });
    } catch {
      toast({ title: "Copy failed", description: "Could not access clipboard", variant: "destructive" });
    }
  };
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="block">
      <Card className="p-4 bg-[#25D366]/10 border-[#25D366]/30 shadow-[var(--shadow-soft)] cursor-pointer transition-transform hover:scale-[1.01] active:scale-[0.99]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center shrink-0">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground truncate">{title}</p>
            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
            <p className="text-xs text-foreground/80 font-mono truncate">{formatted}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            className="shrink-0 h-8 w-8 hover:bg-[#25D366]/20"
            aria-label={`Copy ${title} number`}
          >
            <Copy className="w-4 h-4" />
          </Button>
        </div>
      </Card>
    </a>
  );
}

function GenericResourceView({ resource, mobile }: { resource: Resource; mobile: string }) {
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchResource(resource, mobile)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [resource, mobile]);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-2xl" />
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

  const items = extractItems(data);

  if (!items || items.length === 0) {
    return (
      <Card className="p-5">
        <pre className="text-xs whitespace-pre-wrap break-all text-muted-foreground">
          {JSON.stringify(data, null, 2)}
        </pre>
      </Card>
    );
  }

  if (resource === "cards") {
    return <CardsList items={items as Record<string, unknown>[]} mobile={mobile} />;
  }

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <RecordCard key={i} resource={resource} mobile={mobile} item={item as Record<string, unknown>} />
      ))}
    </div>
  );
}

function StatementsView({ mobile }: { mobile: string }) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => String(currentYear - i));
  const [selected, setSelected] = useState<string>(() => {
    try {
      const v = sessionStorage.getItem("statementsYear");
      if (v) return v;
    } catch (_) {
      /* ignore */
    }
    return String(currentYear);
  });
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    try {
      const v = sessionStorage.getItem("statementsStatus");
      if (v) return v;
    } catch (_) {
      /* ignore */
    }
    return "all";
  });
  useEffect(() => {
    try {
      sessionStorage.setItem("statementsYear", selected);
    } catch (_) {
      /* ignore */
    }
  }, [selected]);
  useEffect(() => {
    try {
      sessionStorage.setItem("statementsStatus", statusFilter);
    } catch (_) {
      /* ignore */
    }
  }, [statusFilter]);
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params: Record<string, string> = {};
    if (selected !== "all") params.year = selected;
    fetchResource("statements", mobile, params)
      .then((d) => {
        if (cancelled) return;
        setItems((extractItems(d) ?? []) as Record<string, unknown>[]);
        const s = (d as { stats?: Record<string, unknown> })?.stats ?? null;
        setStats(s);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [mobile, selected]);

  const filteredItems =
    statusFilter === "all"
      ? items
      : items.filter((i) => {
          const s = String(i.payment_status ?? "").toLowerCase();
          return statusFilter === "PAID" ? s === "paid" : s !== "paid";
        });

  return (
    <div className="space-y-3">
      <StatementStats items={items} stats={stats} activeStatus={statusFilter} onStatClick={setStatusFilter} />
      <div className="grid grid-cols-2 gap-3">
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="h-11">
            <SelectValue placeholder="Filter by year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All years</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={y}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-11">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="PAID">Paid</SelectItem>
            <SelectItem value="NOT_PAID">Unpaid</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {error ? (
        <Card className="p-5 border-destructive/30 bg-destructive/5">
          <p className="text-sm font-medium text-destructive mb-1">Failed to load</p>
          <p className="text-xs text-muted-foreground break-all">{error}</p>
        </Card>
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No statements found.</p>
      ) : (
        filteredItems.map((item, i) => <RecordCard key={i} resource="statements" mobile={mobile} item={item} />)
      )}
    </div>
  );
}

function CardsList({ items, mobile }: { items: Record<string, unknown>[]; mobile: string }) {
  const VIEW_KEY = "mr_cards_view";
  const [selected, setSelected] = useState<string>(() => {
    try {
      const v = sessionStorage.getItem("cardsFilter");
      if (v) return v;
    } catch (_) {
      /* ignore */
    }
    return "all";
  });
  useEffect(() => {
    try {
      sessionStorage.setItem("cardsFilter", selected);
    } catch (_) {
      /* ignore */
    }
  }, [selected]);
  const [view, setView] = useState<"list" | "grid">(() => {
    if (typeof window === "undefined") return "list";
    return (localStorage.getItem(VIEW_KEY) as "list" | "grid") || "list";
  });

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      // ignore
    }
  }, [view]);

  const names = Array.from(
    new Set(items.map((it) => String(it.person_name ?? "").trim()).filter((n) => n.length > 0)),
  ).sort();
  const filtered = selected === "all" ? items : items.filter((it) => String(it.person_name ?? "") === selected);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="h-11 flex-1">
            <SelectValue placeholder="Filter by name" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All names</SelectItem>
            {names.map((n) => (
              <SelectItem key={n} value={n}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="inline-flex h-11 rounded-md border border-input bg-background p-1 shrink-0">
          <button
            type="button"
            onClick={() => setView("list")}
            aria-label="List view"
            aria-pressed={view === "list"}
            className={`flex items-center justify-center w-9 rounded-sm transition-colors ${
              view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setView("grid")}
            aria-label="Grid view"
            aria-pressed={view === "grid"}
            className={`flex items-center justify-center w-9 rounded-sm transition-colors ${
              view === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No cards match the filter.</p>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((item, i) => (
            <CardGridTile key={i} item={item} index={i + 1} />
          ))}
        </div>
      ) : (
        filtered.map((item, i) => <RecordCard key={i} resource="cards" mobile={mobile} item={item} index={i + 1} />)
      )}
    </div>
  );
}

function CardGridTile({ item, index }: { item: Record<string, unknown>; index: number }) {
  const navigate = useNavigate();
  const rcNum = (item.cm_card_number as string) || "";
  const name = String(item.person_name ?? "—");
  const amountRaw = item.amount;
  const amountNum = Number(amountRaw);
  const amount =
    Number.isFinite(amountNum) && amountRaw != null && amountRaw !== ""
      ? `Rs. ${amountNum.toLocaleString("en-PK")}`
      : "—";
  const [detailsOpen, setDetailsOpen] = useState(false);
  const longPress = useLongPress(() => setDetailsOpen(true), 600);
  const open = () => {
    if (rcNum) navigate(`/cards/${encodeURIComponent(rcNum)}`, { state: { card: item } });
  };
  const handleClick = () => {
    if (longPress.isTriggered()) return;
    open();
  };
  return (
    <>
      <Card
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onMouseDown={longPress.start}
        onMouseUp={longPress.cancel}
        onMouseLeave={longPress.cancel}
        onTouchStart={longPress.start}
        onTouchEnd={longPress.cancel}
        onContextMenu={(e) => {
          e.preventDefault();
          setDetailsOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open();
          }
        }}
        className="p-3 border-0 bg-primary text-primary-foreground shadow-[var(--shadow-card)] cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98] select-none"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-mono opacity-90">{String(index).padStart(2, "0")}</span>
          <CreditCard className="w-4 h-4 opacity-90" />
        </div>
        <p className="text-base font-bold leading-tight break-words mb-1">{name}</p>
        <p className="text-sm font-bold mb-2">{amount}</p>
        {rcNum && <p className="text-[11px] opacity-75 break-all font-serif">{rcNum}</p>}
      </Card>
      <CardDetailsPopup item={item} open={detailsOpen} onOpenChange={setDetailsOpen} />
    </>
  );
}

function extractItems(data: unknown): unknown[] | null {
  if (Array.isArray(data)) return data;
  const d = data as { items?: unknown[]; data?: unknown[] };
  if (Array.isArray(d?.items)) return d.items;
  if (Array.isArray(d?.data)) return d.data;
  return null;
}

function RashansView({ mobile }: { mobile: string }) {
  const now = new Date();
  const currentMonth = String(now.getMonth() + 1).padStart(2, "0");
  const currentYear = String(now.getFullYear());
  const [filters, setFilters] = useState<TxnFilters>(() => {
    try {
      const saved = sessionStorage.getItem("rashanFilters");
      if (saved) return JSON.parse(saved) as TxnFilters;
    } catch (_) {
      /* ignore */
    }
    return { status: "all", validFrom: `${currentMonth}/${currentYear}` };
  });

  useEffect(() => {
    try {
      sessionStorage.setItem("rashanFilters", JSON.stringify(filters));
    } catch (_) {
      /* ignore */
    }
  }, [filters]);
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [totalTransactionAmount, setTotalTransactionAmount] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params: Record<string, string> = {};
    const mFull = filters.validFrom.match(/^(\d{1,2})\/(\d{4})$/);
    const mYearOnly = filters.validFrom.match(/^(\d{4})$/);
    const mMonthOnly = filters.validFrom.match(/^(\d{1,2})$/);
    if (mFull) {
      params.monthYear = `${mFull[1].padStart(2, "0")}/${mFull[2]}`;
    } else if (mYearOnly) {
      params.monthYear = mYearOnly[1];
    } else if (mMonthOnly) {
      params.monthYear = `${mMonthOnly[1].padStart(2, "0")}/${currentYear}`;
    }

    fetchResource("transactions", mobile, params)
      .then((d) => {
        if (cancelled) return;
        const list = (extractItems(d) ?? []) as Record<string, unknown>[];
        setItems(list);
        const tta = Number(
          (d as Record<string, unknown>)?.totalTransactionAmount ??
            ((d as Record<string, unknown>)?.data as Record<string, unknown>)?.totalTransactionAmount ??
            0,
        );
        setTotalTransactionAmount(isNaN(tta) ? 0 : tta);
        setStatuses((prev) => {
          const merged = new Set<string>(prev);
          for (const i of list) {
            const s = i.things_status as string;
            if (s) merged.add(s);
          }
          return Array.from(merged).sort();
        });
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [mobile, filters.validFrom]);

  const filtered = items.filter((i) => {
    if (filters.status !== "all" && i.things_status !== filters.status) return false;
    return true;
  });

  if (error) {
    return (
      <Card className="p-5 border-destructive/30 bg-destructive/5">
        <p className="text-sm font-medium text-destructive mb-1">Failed to load</p>
        <p className="text-xs text-muted-foreground break-all">{error}</p>
      </Card>
    );
  }

  return (
    <>
      <TransactionStats
        items={items}
        totalAmount={totalTransactionAmount}
        activeStatus={filters.status}
        onStatClick={(status) => setFilters((f) => ({ ...f, status }))}
      />
      <TransactionFilters statuses={statuses} value={filters} onChange={setFilters} />
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No transactions match the filters.</p>
          ) : (
            <TransactionList items={filtered} />
          )}
        </div>
      )}
    </>
  );
}

const TXN_VIRTUALIZE_THRESHOLD = 30;

function TransactionList({ items }: { items: Record<string, unknown>[] }) {
  if (items.length <= TXN_VIRTUALIZE_THRESHOLD) {
    return (
      <>
        {items.map((item, i) => (
          <TransactionCard key={i} item={item} origin="rashans" />
        ))}
      </>
    );
  }
  return <VirtualTransactionList items={items} />;
}

function VirtualTransactionList({ items }: { items: Record<string, unknown>[] }) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const virtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize: () => 116, // approx card + gap; refined by dynamic measurement
    overscan: 6,
    scrollMargin: parentRef.current?.offsetTop ?? 0,
  });
  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();
  const offset = virtualItems[0]?.start ?? 0;

  return (
    <div ref={parentRef} style={{ position: "relative" }}>
      <div style={{ height: totalSize, position: "relative" }}>
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            transform: `translateY(${offset - (virtualizer.options.scrollMargin ?? 0)}px)`,
          }}
        >
          {virtualItems.map((v) => (
            <div
              key={v.key}
              data-index={v.index}
              ref={virtualizer.measureElement}
              style={{ paddingBottom: 12 }}
            >
              <TransactionCard item={items[v.index]} origin="rashans" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
function StatementPdfButton({ url, title }: { url: string; title: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" size="sm" className="w-full mt-3" onClick={() => setOpen(true)}>
        <FileText className="w-4 h-4 mr-2" />
        View Statement
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl w-[95vw] h-[85vh] p-0 flex flex-col">
          <DialogHeader className="px-4 py-3 border-b">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <DialogTitle className="truncate text-base">{title}</DialogTitle>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}`;
                    const win = window.open(url, "_blank", "noopener,noreferrer");
                    if (!win) {
                      window.open(viewerUrl, "_blank", "noopener,noreferrer");
                      return;
                    }
                    window.setTimeout(() => {
                      if (win.closed) {
                        window.open(viewerUrl, "_blank", "noopener,noreferrer");
                      }
                    }, 1500);
                  }}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open in new tab
                </Button>
                <Button asChild type="button" variant="default" size="sm">
                  <a href={url} download={`${title}.pdf`} target="_blank" rel="noopener noreferrer">
                    <FileDown className="w-4 h-4 mr-2" />
                    Download PDF
                  </a>
                </Button>
              </div>
            </div>
          </DialogHeader>
          <iframe
            src={`https://docs.google.com/viewer?embedded=true&url=${encodeURIComponent(url)}`}
            title={title}
            className="flex-1 w-full border-0 bg-muted"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function RecordCard({
  resource,
  mobile,
  item,
  index,
}: {
  resource: Resource;
  mobile: string;
  item: Record<string, unknown>;
  index?: number;
}) {
  const navigate = useNavigate();
  const entries = Object.entries(item).filter(([, v]) => v !== null && v !== "" && typeof v !== "object");

  if (resource === "cards") {
    const rcNum = (item.cm_card_number as string) || "";
    const summaryFields: { key: string; label: string }[] = [
      { key: "person_name", label: "Name" },
      { key: "amount", label: "Amount" },
      { key: "cm_card_number", label: "Card Number" },
      { key: "mobile_number", label: "Mobile" },
      { key: "city", label: "City" },
      { key: "reg_date", label: "Registration Date" },
    ];
    const [detailsOpen, setDetailsOpen] = useState(false);
    const longPress = useLongPress(() => setDetailsOpen(true), 600);
    const open = () => {
      if (rcNum) navigate(`/cards/${encodeURIComponent(rcNum)}`, { state: { card: item } });
    };
    const handleClick = () => {
      if (longPress.isTriggered()) return;
      open();
    };
    return (
      <>
        <Card
          role="button"
          tabIndex={0}
          onClick={handleClick}
          onMouseDown={longPress.start}
          onMouseUp={longPress.cancel}
          onMouseLeave={longPress.cancel}
          onTouchStart={longPress.start}
          onTouchEnd={longPress.cancel}
          onContextMenu={(e) => {
            e.preventDefault();
            setDetailsOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              open();
            }
          }}
          className="p-5 border-0 bg-primary text-primary-foreground shadow-[var(--shadow-card)] cursor-pointer transition-transform hover:scale-[1.01] active:scale-[0.99] select-none"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {index != null && <span className="text-sm font-mono opacity-90">{String(index).padStart(2, "0")}</span>}
              <CreditCard className="w-5 h-5 opacity-90" />
            </div>
            <span className="text-xs uppercase tracking-wider opacity-75">میرا راشن کارڈ</span>
          </div>
          <div className="space-y-1">
            {summaryFields.map(({ key, label }) => {
              const raw = item[key];
              const isEmpty = raw == null || raw === "";
              let display: string;
              if (isEmpty) {
                display = "—";
              } else if (key === "amount") {
                const n = Number(raw);
                display = Number.isFinite(n) ? `Rs. ${n.toLocaleString("en-PK")}` : String(raw);
              } else {
                display = String(raw);
              }
              const isBold = key === "person_name" || key === "amount";
              const hideLabel = key === "person_name" || key === "amount" || key === "cm_card_number";
              const isName = key === "person_name";
              return (
                <div key={key} className={`flex justify-between ${isName ? "" : "text-sm"}`}>
                  {!hideLabel && <span className={`${isBold ? "font-bold" : "opacity-75"}`}>{label}</span>}
                  <span
                    className={`text-right break-all ${isBold ? "font-bold" : "opacity-75"} ${hideLabel ? "w-full text-left" : ""} ${isName ? "text-xl" : ""}`}
                  >
                    {display}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
        <CardDetailsPopup item={item} open={detailsOpen} onOpenChange={setDetailsOpen} />
      </>
    );
  }

  if (resource === "statements") {
    const fields: { key: string; label: string }[] = [
      { key: "statement_period", label: "Statement Period" },
      { key: "invoice_total", label: "Invoice Total" },
      { key: "payment_status", label: "Payment Status" },
    ];
    const fileUrl = (item.statement_file as string) || "";
    const statusLower = String(item.payment_status ?? "").toLowerCase();
    const paid = statusLower === "paid";
    const notPaid = statusLower === "not_paid";
    return (
      <Card className="p-4 bg-card/80 backdrop-blur shadow-[var(--shadow-soft)] border-border/50">
        <div className="space-y-1.5">
          {fields.map(({ key, label }) => {
            const raw = item[key];
            const isEmpty = raw == null || raw === "";
            let display: React.ReactNode;
            if (isEmpty) {
              display = "—";
            } else if (key === "invoice_total") {
              const n = Number(raw);
              display = Number.isFinite(n) ? `Rs. ${n.toLocaleString("en-PK")}` : String(raw);
            } else if (key === "payment_status") {
              display = (
                <Badge variant={paid ? "default" : notPaid ? "destructive" : "outline"} className="font-normal">
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
          })}
        </div>
        {fileUrl && <StatementPdfButton url={fileUrl} title={String(item.statement_period ?? "Statement")} />}
      </Card>
    );
  }

  return (
    <Card className="p-4 bg-card/80 backdrop-blur shadow-[var(--shadow-soft)] border-border/50">
      <div className="space-y-1.5">
        {entries.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 text-sm">
            <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</span>
            <span className="font-medium text-foreground text-right break-all">{String(v)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

const TABS: { id: Resource; label: string; icon: typeof CreditCard }[] = [
  { id: "customers", label: "Home", icon: User },
  { id: "transactions", label: "Rashans", icon: ArrowLeftRight },
  { id: "cards", label: "Cards", icon: CreditCard },
  { id: "statements", label: "Statements", icon: FileText },
];

const Index = () => {
  const navigate = useNavigate();
  const [mobile, setMobile] = useState<string | null>(null);
  const [tab, setTab] = useState<Resource>(() => {
    try {
      const valid = ["customers", "cards", "transactions", "statements"];
      const path = window.location.pathname.replace(/^\//, "").toLowerCase();
      if (valid.includes(path)) return path as Resource;
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get("tab");
      if (fromUrl && valid.includes(fromUrl)) return fromUrl as Resource;
      const saved = sessionStorage.getItem("activeTab");
      if (saved) return saved as Resource;
    } catch (_) {
      /* ignore */
    }
    return "customers";
  });
  useEffect(() => {
    try {
      sessionStorage.setItem("activeTab", tab);
    } catch (_) {
      /* ignore */
    }
  }, [tab]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notifUnread, setNotifUnread] = useState<number>(() => {
    try { return unreadCount(); } catch { return 0; }
  });
  useEffect(() => {
    void syncNotificationInbox();
    const update = () => setNotifUnread(unreadCount());
    update();
    return subscribeNotifications(update);
  }, []);

  const [pushEnabled, setPushEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    const check = async () => {
      try {
        if (isNativePlatform()) {
          setPushEnabled(localStorage.getItem(NATIVE_PUSH_ENABLED_KEY) === "1");
          return;
        }
        if (!pushSupported()) {
          setPushEnabled(false);
          return;
        }
        const sub = await getCurrentSubscription();
        setPushEnabled(!!sub && Notification.permission === "granted");
      } catch {
        setPushEnabled(false);
      }
    };
    void check();
    const onVis = () => { if (document.visibilityState === "visible") void check(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", check);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", check);
    };
  }, []);

  const slideInClosingRef = useRef(false);
  const handleSlideInOpenChange = (setter: (v: boolean) => void) => (open: boolean) => {
    if (!open) {
      slideInClosingRef.current = true;
      window.setTimeout(() => {
        slideInClosingRef.current = false;
      }, 400);
    }
    setter(open);
  };
  const [profileData, setProfileData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    const extract = (email?: string | null, meta?: Record<string, unknown> | null) => {
      const fromMeta = typeof meta?.mobile === "string" ? (meta.mobile as string) : null;
      if (fromMeta) return fromMeta;
      if (email && email.endsWith(`@${PHONE_EMAIL_DOMAIN}`)) {
        return email.slice(0, -1 - PHONE_EMAIL_DOMAIN.length);
      }
      return null;
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const m = extract(session?.user?.email, session?.user?.user_metadata as Record<string, unknown> | null);
      setMobile(m);
      if (m) localStorage.setItem(STORAGE_KEY, m);
      else localStorage.removeItem(STORAGE_KEY);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      const m = extract(session?.user?.email, session?.user?.user_metadata as Record<string, unknown> | null);
      if (m) {
        setMobile(m);
        localStorage.setItem(STORAGE_KEY, m);
      } else {
        // fall back to legacy local storage value during migration
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) setMobile(saved);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!mobile) return;
    let cancelled = false;
    fetchResource("customers", mobile)
      .then((d) => {
        if (cancelled) return;
        const items = extractItems(d);
        const first = (items && items[0]) || d;
        setProfileData(first as Record<string, unknown>);
      })
      .catch(() => {
        // silently fail; header falls back to mobile number
      });
    return () => {
      cancelled = true;
    };
  }, [mobile]);

  const handleLogin = (m: string) => {
    localStorage.setItem(STORAGE_KEY, m);
    setMobile(m);
    toast({ title: "Welcome", description: `Signed in as ${m}` });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem(STORAGE_KEY);
    setMobile(null);
    setProfileData(null);
  };

  if (!mobile)
    return (
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
          </div>
        }
      >
        <Login onLogin={handleLogin} />
      </Suspense>
    );

  const displayName = profileData?.contact_person_eng || profileData?.contact_person || `+${mobile}`;
  const isActive =
    profileData?.is_active === true ||
    profileData?.is_active === "true" ||
    profileData?.is_active === 1 ||
    profileData?.is_active === "1";

  return (
    <div className="min-h-screen pb-32">
      <header className="px-5 pt-10 pb-6 text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm text-primary-foreground text-sm font-semibold ring-1 ring-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 hover:bg-white/25 transition-colors"
            >
              {String(displayName)
                .replace(/^\+/, "")
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((s) => s[0])
                .join("")
                .toUpperCase() || "U"}
            </button>
            <div className="min-w-0">
              <h1 className="text-xl font-bold leading-tight truncate">{tab === "transactions" ? "Monthly Rashans" : tab === "cards" ? "Rashan Cards" : tab === "statements" ? "Monthly Statements" : String(displayName)}</h1>
              {profileData && tab === "customers" && (
                <span
                  className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    isActive
                      ? "bg-green-400/20 text-green-50 ring-1 ring-green-300/40"
                      : "bg-red-400/20 text-red-50 ring-1 ring-red-300/40"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-green-300" : "bg-red-300"}`} />
                  {isActive ? "Active" : "Inactive"}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <Sheet
        open={menuOpen}
        onOpenChange={(open) => {
          // Keep sidebar open while a slide-in panel (profile/help/settings) is showing
          if (!open && (profileOpen || helpOpen || settingsOpen || slideInClosingRef.current)) return;
          setMenuOpen(open);
        }}
      >
        <SheetContent
          side="left"
          className="w-72 flex flex-col"
        >

          <SheetHeader>
            <SheetTitle className="truncate">{String(displayName)}</SheetTitle>
          </SheetHeader>
          {profileData?.payer_id && (
            <div className="mt-4 flex items-center gap-2 rounded-md border border-border/60 bg-muted/40 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Customer number</p>
                <p className="text-sm font-semibold text-foreground truncate">{String(profileData.payer_id)}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                aria-label="Copy customer number"
                onClick={async () => {
                  const val = String(profileData.payer_id);
                  try {
                    await navigator.clipboard.writeText(val);
                    toast({ title: "Copied", description: `${val} copied to clipboard` });
                  } catch {
                    toast({ title: "Copy failed", description: "Could not access clipboard", variant: "destructive" });
                  }
                }}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          )}
          <div className="flex flex-col gap-1 mt-4">
            <button
              type="button"
              onClick={() => {
                setHelpOpen(false);
                setProfileOpen(true);
              }}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm hover:bg-muted transition-colors"
            >
              <User className="w-4 h-4" />
              <span>Profile</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setProfileOpen(false);
                setHelpOpen(true);
              }}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm hover:bg-muted transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
              <span className="flex-1">Help</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setProfileOpen(false);
                setHelpOpen(false);
                setSettingsOpen(true);
              }}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm hover:bg-muted transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span className="flex-1">Settings</span>
            </button>



            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                handleLogout();
              }}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm hover:bg-muted transition-colors text-destructive"
            >
              <LogOut className="w-4 h-4" />
              <span>Log out</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <main className="px-5 pt-5">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Resource)} className="w-full">
          {TABS.map(({ id }) => (
            <TabsContent key={id} value={id} className="mt-0">
              <ResourceView resource={id} mobile={mobile} onNavigate={setTab} />
            </TabsContent>
          ))}
        </Tabs>
      </main>

      <PageFooter />

      <nav
        className="fixed bottom-0 inset-x-0 z-40 border-t border-border/60 bg-card/85 backdrop-blur-md shadow-[0_-4px_20px_-8px_hsl(var(--foreground)/0.15)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Primary"
      >
        <div className="mx-auto max-w-2xl grid grid-cols-5 h-16">
          {TABS.map(({ id, label, icon: Icon }, idx) => {
            const active = tab === id;
            const tabButton = (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span
                  className={`flex items-center justify-center w-12 h-7 rounded-full transition-colors ${
                    active ? "bg-primary/15 ring-1 ring-primary/30" : ""
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </span>
                <span className={`text-[10px] ${active ? "font-semibold text-primary" : "font-medium"}`}>{label}</span>
              </button>
            );
            if (idx === 2) {
              return (
                <span key={id} className="contents">
                  <button
                    type="button"
                    onClick={() => navigate("/notifications")}
                    aria-label="Notifications"
                    className="relative flex flex-col items-center justify-center gap-0.5 text-primary-foreground"
                  >
                    <span className="relative -mt-6">
                      <span className="flex items-center justify-center w-12 h-12 rounded-full bg-primary shadow-[0_8px_20px_-6px_hsl(var(--primary)/0.6)] ring-4 ring-card overflow-hidden">
                        <img src={meraRashanLogo} alt="Mera Rashan" className="w-full h-full object-cover" />
                      </span>
                      {notifUnread > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center ring-2 ring-card">
                          {notifUnread > 99 ? "99+" : notifUnread}
                        </span>
                      )}
                    </span>

                    <span className="text-[10px] font-medium text-muted-foreground">Alerts</span>
                  </button>
                  {tabButton}
                </span>
              );
            }
            return tabButton;
          })}
        </div>
      </nav>

      <DialogPrimitive.Root open={profileOpen} onOpenChange={handleSlideInOpenChange(setProfileOpen)} modal={false}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Content
            onInteractOutside={(e) => e.preventDefault()}
            className="fixed inset-y-0 right-0 z-50 h-full w-full sm:max-w-md border-l bg-background p-6 shadow-lg overflow-y-auto data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right data-[state=closed]:duration-300 data-[state=open]:duration-500"
          >
            <div className="mb-2">
              <DialogPrimitive.Close
                className="-ml-2 inline-flex items-center justify-center rounded-md p-2 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label="Back"
              >
                <ArrowLeft className="h-5 w-5" />
              </DialogPrimitive.Close>
              <div className="h-6" aria-hidden />
              <DialogPrimitive.Title className="text-lg font-semibold text-foreground">
                Profile
              </DialogPrimitive.Title>
            </div>
            <div className="pt-2">
              <ProfileView mobile={mobile} profileOnly />
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <DialogPrimitive.Root open={helpOpen} onOpenChange={handleSlideInOpenChange(setHelpOpen)} modal={false}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Content
            onInteractOutside={(e) => e.preventDefault()}
            className="fixed inset-y-0 right-0 z-50 h-full w-full sm:max-w-md border-l bg-background p-6 shadow-lg overflow-y-auto data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right data-[state=closed]:duration-300 data-[state=open]:duration-500"
          >
            <div className="mb-2">
              <DialogPrimitive.Close
                className="-ml-2 inline-flex items-center justify-center rounded-md p-2 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label="Back"
              >
                <ArrowLeft className="h-5 w-5" />
              </DialogPrimitive.Close>
              <div className="h-6" aria-hidden />
              <DialogPrimitive.Title className="text-lg font-semibold text-foreground">
                Help &amp; Support
              </DialogPrimitive.Title>
              <p className="mt-2 text-sm text-muted-foreground">
                Get instant help from our virtual agent 24/7. Live support: Mon-Sun 06:00-18:00 (UTC)
              </p>
            </div>
            <div className="space-y-3 pt-4">
              <WhatsAppTile
                href="https://wa.me/923030812222"
                number="923030812222"
                title="Mera Rashan Support"
                subtitle="Chat on WhatsApp"
              />
              <WhatsAppTile
                href="https://wa.me/923091493053"
                number="923091493053"
                title="Mera Rashan Chat Bot"
                subtitle="Automated assistant"
              />
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <DialogPrimitive.Root open={settingsOpen} onOpenChange={handleSlideInOpenChange(setSettingsOpen)} modal={false}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Content
            onInteractOutside={(e) => e.preventDefault()}
            className="fixed inset-y-0 right-0 z-50 h-full w-full sm:max-w-md border-l bg-background p-6 shadow-lg overflow-y-auto data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right data-[state=closed]:duration-300 data-[state=open]:duration-500"
          >
            <div className="mb-2">
              <DialogPrimitive.Close
                className="-ml-2 inline-flex items-center justify-center rounded-md p-2 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label="Back"
              >
                <ArrowLeft className="h-5 w-5" />
              </DialogPrimitive.Close>
              <div className="h-6" aria-hidden />
              <DialogPrimitive.Title className="text-lg font-semibold text-foreground">
                Settings
              </DialogPrimitive.Title>
            </div>
            <div className="space-y-3 pt-4">
              <NotificationToggle mobile={mobile} />
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  );
};

export default Index;
