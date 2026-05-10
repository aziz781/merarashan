import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Receipt, CreditCard, Calendar, Tag, Info } from "lucide-react";
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
    title: "Status",
    icon: Tag,
    match: (k) => /(status|state|delivered|pending)/i.test(k) && !/(payment_status|code_status)/i.test(k),
  },
  {
    id: "card",
    title: "Card",
    icon: CreditCard,
    match: (k) => /(rc_num|card|cm_|amount|price|gross|net|fee|discount|paid|balance)/i.test(k) && !/(charge|total)/i.test(k),
  },
  {
    id: "dates",
    title: "Dates & Period",
    icon: Calendar,
    match: (k) =>
      /(date|time|month|year|period|valid_from|valid_to|created|updated|delivered_at)/i.test(k),
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
        : lower === "not_paid" || lower === "cancelled"
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
  return k
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const RashanDetails = () => {
  const navigate = useNavigate();
  const location = useLocation() as { state?: { item?: Item } };
  const item = location.state?.item;

  if (!item) {
    return (
      <div className="min-h-screen px-5 pt-10">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2 mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">
            No rashan data. Open this page from the rashans list.
          </p>
        </Card>
      </div>
    );
  }

  const entries = Object.entries(item).filter(
    ([, v]) => v !== undefined && typeof v !== "object",
  );

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
    return { ...c, rows };
  }).filter((g) => g.rows.length > 0);

  const otherRows = entries.filter(([k]) => !used.has(k));
  if (otherRows.length > 0) {
    grouped.push({
      id: "other",
      title: "Other",
      icon: Info,
      match: () => true,
      rows: otherRows,
    });
  }

  const title =
    (item.code_user_name as string) ||
    (item.person_name as string) ||
    (item.month_year as string) ||
    "Rashan Details";

  const subtitle =
    (item.datetime_display as string) ||
    (item.month_year as string) ||
    "";

  return (
    <div className="min-h-screen pb-16">
      <header
        className="px-5 pt-10 pb-6 text-primary-foreground"
        style={{ background: "var(--gradient-primary)" }}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
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
          <Card
            key={id}
            className="p-4 bg-card/90 backdrop-blur shadow-[var(--shadow-soft)] border-border/50"
          >
            <div className="flex items-center gap-2 mb-3">
              <Icon className="w-4 h-4 text-primary" />
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
                {title}
              </p>
            </div>
            <div className="space-y-1.5">
              {rows.map(([k, v]) => (
                <div
                  key={k}
                  className="flex justify-between gap-3 text-sm items-center border-b border-border/40 py-1.5 last:border-0"
                >
                  {k !== "rc_num" && (
                    <span className="text-muted-foreground">{humanizeKey(k)}</span>
                  )}
                  <span className="font-medium text-foreground text-right break-all">
                    {formatValue(k, v)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </main>
      <PageFooter />
    </div>
  );
};

export default RashanDetails;
