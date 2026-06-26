import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard } from "lucide-react";

function useIsDark() {
  const [isDark, setIsDark] = useState(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("dark"),
  );
  useEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.documentElement;
    const update = () => setIsDark(el.classList.contains("dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return isDark;
}
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Resource } from "@/lib/api";
import { useLongPress } from "@/hooks/use-long-press";
import { CardDetailsPopup } from "@/components/CardDetailsPopup";
import { StatementPdfButton } from "@/components/StatementPdfButton";

const CARD_SUMMARY_FIELDS: { key: string; label: string }[] = [
  { key: "person_name", label: "Name" },
  { key: "amount", label: "Amount" },
  { key: "cm_card_number", label: "Card Number" },
  { key: "mobile_number", label: "Mobile" },
  { key: "city", label: "City" },
  { key: "reg_date", label: "Registration Date" },
];

interface CardRowProps {
  item: Record<string, unknown>;
  index?: number;
}

function CardRecordCard({ item, index }: CardRowProps) {
  const isDark = useIsDark();
  const navigate = useNavigate();
  const rcNum = (item.cm_card_number as string) || "";
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
        style={{ backgroundColor: "hsl(158 64% 20%)" }}
        className="p-5 border-0 text-white shadow-[var(--shadow-card)] cursor-pointer transition-transform hover:scale-[1.01] active:scale-[0.99] select-none"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {index != null && <span className="text-sm font-mono opacity-90">{String(index).padStart(2, "0")}</span>}
            <CreditCard className="w-5 h-5 opacity-90" aria-hidden />
          </div>
          <span className="text-xs uppercase tracking-wider opacity-75">میرا راشن کارڈ</span>
        </div>
        <div className="space-y-1">
          {CARD_SUMMARY_FIELDS.map(({ key, label }) => {
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

export function CardGridTile({ item, index }: { item: Record<string, unknown>; index: number }) {
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
        style={{ backgroundColor: "hsl(158 64% 20%)" }}
        className="p-3 border-0 text-white shadow-[var(--shadow-card)] cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98] select-none"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-mono opacity-90">{String(index).padStart(2, "0")}</span>
          <CreditCard className="w-4 h-4 opacity-90" aria-hidden />
        </div>
        <p className="text-base font-bold leading-tight break-words mb-1">{name}</p>
        <p className="text-sm font-bold mb-2">{amount}</p>
        {rcNum && <p className="text-[11px] opacity-75 break-all font-serif">{rcNum}</p>}
      </Card>
      <CardDetailsPopup item={item} open={detailsOpen} onOpenChange={setDetailsOpen} />
    </>
  );
}

const STATEMENT_FIELDS: { key: string; label: string }[] = [
  { key: "statement_period", label: "Statement Period" },
  { key: "invoice_total", label: "Invoice Total" },
  { key: "payment_status", label: "Payment Status" },
];

function StatementRecordCard({ item }: { item: Record<string, unknown> }) {
  const fileUrl = (item.statement_file as string) || "";
  const statusLower = String(item.payment_status ?? "").toLowerCase();
  const paid = statusLower === "paid";
  const notPaid = statusLower === "not_paid";
  return (
    <Card className="p-4 bg-card/80 backdrop-blur shadow-[var(--shadow-soft)] border-border/50">
      <div className="space-y-1.5">
        {STATEMENT_FIELDS.map(({ key, label }) => {
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

function GenericRecordCard({ item }: { item: Record<string, unknown> }) {
  const entries = Object.entries(item).filter(([, v]) => v !== null && v !== "" && typeof v !== "object");
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

export function RecordCard({
  resource,
  item,
  index,
}: {
  resource: Resource;
  /** Retained for API compatibility but unused at this level. */
  mobile?: string;
  item: Record<string, unknown>;
  index?: number;
}) {
  if (resource === "cards") return <CardRecordCard item={item} index={index} />;
  if (resource === "statements") return <StatementRecordCard item={item} />;
  return <GenericRecordCard item={item} />;
}
