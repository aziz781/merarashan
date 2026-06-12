import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Receipt,
  CreditCard,
  Calendar,
  Tag,
  MessageSquare,
  TicketPercent,
  ShoppingBag,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageFooter } from "@/components/PageFooter";

type Item = Record<string, unknown>;

const CATEGORIES: {
  id: string;
  title: string;
  icon: typeof Receipt;
  match: (key: string) => boolean;
}[] = [
  {
    id: "status",
    title: "RASHAN",
    icon: Tag,
    match: (k) =>
      k === "datetime_display" ||
      (/(status|state|delivered|pending)/i.test(k) && !/(payment_status|code_status)/i.test(k)),
  },
  {
    id: "card",
    title: "Card",
    icon: CreditCard,
    match: (k) =>
      /(rc_num|card|cm_|amount|price|gross|net|fee|discount|paid|balance)/i.test(k) && !/(charge|total)/i.test(k),
  },
  {
    id: "dates",
    title: "UPDATES",
    icon: Calendar,
    match: (k) =>
      /(date|time|period|created|updated|delivered_at)/i.test(k) && k !== "month_year" && k !== "payment_datetime",
  },
];

function isMoneyKey(k: string) {
  return /(amount|charge|price|total|gross|net|fee|discount|paid|balance)/i.test(k);
}

function formatValue(key: string, raw: unknown): React.ReactNode {
  if (raw == null || raw === "") return "—";
  if (typeof raw === "boolean") {
    return (
      <Badge variant={raw ? "default" : "outline"} className="font-normal">
        {raw ? "Yes" : "No"}
      </Badge>
    );
  }
  if (/status$/i.test(key)) {
    const s = String(raw);
    const lower = s.toLowerCase();
    const variant =
      lower === "delivered" || lower === "paid"
        ? "default"
        : lower === "not_paid" || lower === "cancelled" || lower === "not_delivered"
          ? "destructive"
          : "outline";
    return (
      <Badge variant={variant} className="font-normal">
        {s}
      </Badge>
    );
  }
  if (isMoneyKey(key)) {
    const n = Number(raw);
    if (Number.isFinite(n) && String(raw).trim() !== "") {
      return `Rs. ${n.toLocaleString("en-PK")}`;
    }
  }
  return String(raw);
}

function humanizeKey(k: string) {
  if (k === "things_status") return "Status";
  return k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

type TimelineStep = {
  label: string;
  dateKey: string;
  timeKey: string;
  statusKey?: string;
  fallbackStatus?: string;
  detailKey?: string;
  detailPrefix?: string;
  detailCodeKey?: string;
  detailConnector?: string;
  detailSuffixKey?: string;
  detailSuffixLabel?: string;
};

const TIMELINE_STEPS: TimelineStep[] = [
  {
    label: "Rashan Code",
    dateKey: "created_date",
    timeKey: "created_time",
    detailKey: "userMobileNumber",
    detailPrefix: "Rashan Code",
    detailCodeKey: "unique_code",
    detailConnector: "sent in SMS at",
  },
  {
    label: "Redeemed",
    dateKey: "accept_datetime",
    timeKey: "",
    statusKey: "code_status",
    detailKey: "registered_business_number",
    detailPrefix: "Redeemed at Karyana Store",
  },
  {
    label: "Collected",
    dateKey: "confirm_datetime",
    timeKey: "",
    statusKey: "things_status",
    detailKey: "registered_business_number",
    detailPrefix: "Collected at Karyana Store",
  },
  {
    label: "Payment",
    dateKey: "payment_datetime",
    timeKey: "",
    statusKey: "payment_status",
    detailKey: "payment_method",
    detailPrefix: "Paid, Karyana Store ({registered_business_number}) in",
    detailSuffixKey: "payment_account",
    detailSuffixLabel: "account",
  },
  {
    label: "Completed",
    dateKey: "",
    timeKey: "",
    statusKey: "payment_status",
  },
];

function UpdatesTimeline({ item }: { item: Item }) {
  const get = (k: string) => {
    const v = item[k];
    return v == null || v === "" ? "" : String(v);
  };

  return (
    <ol className="relative">
      {TIMELINE_STEPS.filter((s) => {
        const status = get(s.statusKey!);
        if (s.label === "Completed") return status.toUpperCase() === "PAID";
        return true;
      }).map((step, idx, arr) => {
        const date = get(step.dateKey);
        const time = get(step.timeKey);
        const detail = step.detailKey ? get(step.detailKey) : "";
        const statusVal = step.statusKey ? get(step.statusKey) : step.fallbackStatus || "";
        const done =
          step.statusKey === "code_status"
            ? statusVal.toUpperCase() === "USED"
            : step.statusKey === "things_status"
              ? statusVal.toLowerCase() === "delivered"
              : step.statusKey === "payment_status"
                ? statusVal.toUpperCase() === "PAID"
                : Boolean(date || time || statusVal);
        const isLast = idx === arr.length - 1;
        const lower = statusVal.toLowerCase();
        const variant: "default" | "destructive" | "outline" =
          lower === "delivered" ||
          lower === "paid" ||
          lower === "completed" ||
          lower === "accepted" ||
          lower === "confirmed"
            ? "default"
            : lower === "not_paid" || lower === "not_delivered" || lower === "cancelled" || lower === "rejected"
              ? "destructive"
              : "outline";

        return (
          <li key={step.label} className="relative pl-7 pb-5 last:pb-0">
            {!isLast && (
              <span
                aria-hidden
                className={`absolute left-[9px] top-4 bottom-0 w-px ${done ? "bg-primary/40" : "bg-border"}`}
              />
            )}
            <span
              aria-hidden
              className={`absolute left-0 top-1 flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 ${
                step.label === "Completed" && done
                  ? "border-emerald-700 bg-emerald-700"
                  : done
                    ? "border-primary bg-primary"
                    : "border-border bg-background"
              }`}
            >
              {step.label === "Completed" && done ? (
                <Check className="h-3 w-3 text-white" />
              ) : done ? (
                <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
              ) : null}
            </span>
            <div className="flex items-start justify-between gap-3">
              <p className={`text-sm font-medium ${done ? "text-foreground" : "text-muted-foreground"}`}>
                {step.label}
              </p>
            </div>
            {(date || time) &&
              ((step.statusKey !== "things_status" &&
                step.statusKey !== "code_status" &&
                step.statusKey !== "payment_status") ||
                (step.statusKey === "payment_status"
                  ? statusVal.toUpperCase() === "PAID"
                  : get("things_status").toLowerCase() === "delivered")) && (
                <p className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                  {date && <span>📅 {date}</span>}
                  {time && <span>🕒 {time}</span>}
                </p>
              )}
            {detail &&
              step.detailPrefix &&
              (step.statusKey === "things_status" ? statusVal.toLowerCase() === "delivered" : date || time) && (
                <p className="mt-1 text-xs text-muted-foreground flex items-start gap-1.5">
                  {step.detailConnector?.toLowerCase().includes("sms") && (
                    <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
                  )}
                  {step.statusKey === "code_status" && (
                    <TicketPercent className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
                  )}
                  {step.statusKey === "things_status" && (
                    <ShoppingBag className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
                  )}
                  {step.statusKey === "payment_status" && (
                    <Receipt className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
                  )}
                  <span>
                    {step.detailPrefix.replace(/\{(\w+)\}/g, (_, key) => get(key))}{" "}
                    {step.detailCodeKey && `(${get(step.detailCodeKey)})`}{" "}
                    {step.detailConnector && `${step.detailConnector} `}
                    {detail}
                    {step.detailSuffixKey &&
                      step.detailSuffixLabel &&
                      ` ${step.detailSuffixLabel} (${get(step.detailSuffixKey)})`}
                  </span>
                </p>
              )}
          </li>
        );
      })}
    </ol>
  );
}

const RashanDetails = () => {
  const navigate = useNavigate();
  const location = useLocation() as { state?: { item?: Item; origin?: "home" | "rashans" } };
  let item = location.state?.item;
  let origin = location.state?.origin ?? "home";
  if (!item) {
    try {
      const raw = sessionStorage.getItem("rashanDetailItem");
      if (raw) {
        const parsed = JSON.parse(raw) as { item?: Item; origin?: "home" | "rashans" };
        item = parsed.item;
        origin = parsed.origin ?? origin;
      }
    } catch (_) { /* ignore */ }
  }
  const goBack = () => {
    try {
      sessionStorage.setItem("activeTab", origin === "rashans" ? "transactions" : "customers");
    } catch (_) {
      /* ignore */
    }
    navigate("/");
  };

  if (!item) {
    return (
      <div className="min-h-screen px-5 pt-10">
        <Button variant="ghost" size="sm" onClick={goBack} className="-ml-2 mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">No rashan data. Open this page from the rashans list.</p>
        </Card>
      </div>
    );
  }

  const entries = Object.entries(item).filter(([, v]) => v !== undefined && typeof v !== "object");

  const used = new Set<string>();
  const grouped = CATEGORIES.map((c) => {
    const rows = entries.filter(([k]) => {
      if (used.has(k)) return false;
      if (!c.match(k)) return false;
      used.add(k);
      return true;
    });
    if (c.id === "card") {
      rows.sort((a, b) => {
        if (a[0] === "rc_num") return -1;
        if (b[0] === "rc_num") return 1;
        return a[0].localeCompare(b[0]);
      });
    }
    if (c.id === "dates") {
      rows.sort((a, b) => {
        if (a[0] === "created_date") return -1;
        if (b[0] === "created_date") return 1;
        return 0;
      });
    }
    return { ...c, rows };
  }).filter((g) => g.rows.length > 0);

  const title =
    (item.code_user_name as string) || (item.person_name as string) || (item.month_year as string) || "Rashan Details";

  const subtitle = (item.month_year as string) || "";

  return (
    <div className="min-h-screen pb-16">
      <header className="px-5 pt-10 pb-6 text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
        <Button
          variant="ghost"
          size="sm"
          onClick={goBack}
          className="text-primary-foreground hover:bg-white/10 -ml-2 mb-3"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <div className="flex items-center gap-3">
          <Receipt className="w-6 h-6 opacity-90" />
          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate">{title}</h1>
            {subtitle && <p className="text-xs opacity-80 truncate">{subtitle}</p>}
          </div>
        </div>
      </header>

      <main className="px-5 -mt-3 space-y-4">
        {grouped.map(({ id, title, icon: Icon, rows }) => (
          <Card key={id} className="p-4 bg-card/90 backdrop-blur shadow-[var(--shadow-soft)] border-border/50">
            <div className="flex items-center gap-2 mb-3">
              <Icon className="w-4 h-4 text-primary" />
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold">{title}</p>
            </div>
            {id === "dates" ? (
              <UpdatesTimeline item={item} />
            ) : (
              <div className="space-y-1.5">
                {rows.map(([k, v]) => (
                  <div
                    key={k}
                    className="flex justify-between gap-3 text-sm items-center border-b border-border/40 py-1.5 last:border-0"
                  >
                    {k === "rc_num" || k.toLowerCase() === "amount" ? null : k ===
                      "datetime_display" ? null : humanizeKey(k).toLowerCase() === "status" ? null : (
                      <span className="text-muted-foreground">{humanizeKey(k)}</span>
                    )}
                    {(() => {
                      const cd = item.confirm_datetime;
                      const empty = cd == null || String(cd).trim() === "" || String(cd).trim().toUpperCase() === "N/A";
                      const isExpired = String(item.code_status ?? "").toUpperCase() === "EXPIRED";
                      const showExpired = k === "datetime_display" && isExpired;
                      const showPlaceholder = k === "datetime_display" && empty && !isExpired;
                      const colorCls = showExpired
                        ? "text-destructive font-normal italic"
                        : k === "datetime_display"
                          ? "text-muted-foreground font-normal italic"
                          : k === "rc_num"
                            ? "text-muted-foreground font-bold italic"
                            : isMoneyKey(k)
                              ? "text-muted-foreground font-normal italic"
                              : "text-foreground";
                      return (
                        <span className={`font-medium text-right break-all ml-auto ${colorCls}`}>
                          {showExpired
                            ? `Rashan code is expired as not used by ${item.valid_to || "—"}.`
                            : showPlaceholder
                              ? `Rashan code has not been used yet. Use by ${item.valid_to || "—"}`
                              : formatValue(k, v)}
                        </span>
                      );
                    })()}
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </main>
      <PageFooter />
    </div>
  );
};

export default RashanDetails;
