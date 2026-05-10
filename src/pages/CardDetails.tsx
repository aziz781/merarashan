import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchResource } from "@/lib/api";
import { TransactionCard } from "@/components/TransactionCard";
import { PageFooter } from "@/components/PageFooter";

const STORAGE_KEY = "mr_mobile";

function extractItems(data: unknown): unknown[] | null {
  if (Array.isArray(data)) return data;
  const d = data as { items?: unknown[]; data?: unknown[] };
  if (Array.isArray(d?.items)) return d.items;
  if (Array.isArray(d?.data)) return d.data;
  return null;
}

const CardDetails = () => {
  const navigate = useNavigate();
  const location = useLocation() as { state?: { card?: Record<string, unknown> } };
  const { rcNum: rcNumParam } = useParams();
  const card = location.state?.card;
  const mobile = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
  const rcNum = rcNumParam || (card?.cm_card_number as string) || "";

  const [txns, setTxns] = useState<Record<string, unknown>[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mobile || !rcNum) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchResource<unknown>("transactions", mobile, { rcNum })
      .then((d) => {
        if (cancelled) return;
        setTxns((extractItems(d) ?? []) as Record<string, unknown>[]);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [mobile, rcNum]);

  const fields: { key: string; label: string }[] = [
    { key: "person_name", label: "Name" },
    { key: "cm_card_number", label: "Rashan" },
    { key: "mobile_number", label: "Mobile" },
    { key: "city", label: "City" },
    { key: "reg_date", label: "Registration Date" },
  ];

  const title =
    (card?.person_name as string) ||
    (card?.card_name as string) ||
    (card?.cm_card_number as string) ||
    "Card Details";

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
          <CreditCard className="w-6 h-6 opacity-90" />
          <h1 className="text-xl font-bold truncate">میرا راشن کارڈ</h1>
        </div>
      </header>

      <main className="px-5 -mt-3 space-y-5">
      {card ? (
        <>
          <h2 className="text-sm font-semibold text-foreground mb-3">Rashan</h2>
          <Card className="p-5 bg-card/90 backdrop-blur shadow-[var(--shadow-card)] border-0">
            <div className="space-y-1.5">
              {fields.map(({ key, label }) => {
                const isName = key === "person_name";
                const raw = card[key];
                let display: string;
                if (raw == null || raw === "") {
                  display = "—";
                } else {
                  display = String(raw);
                }
                return (
                  <div
                    key={key}
                    className={`flex justify-between gap-3 border-b border-border/50 py-1.5 last:border-0 ${isName ? "" : "text-sm"}`}
                  >
                    {!isName && (
                      <span className={isName ? "font-bold text-foreground" : "text-muted-foreground"}>
                        {label}
                      </span>
                    )}
                    <span className={`break-all ${isName ? "font-bold text-foreground" : "text-muted-foreground"} ${isName ? "w-full text-right" : "text-right"} ${isName ? "text-xl" : ""}`}>
                      {display}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      ) : (
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">
            No card data. Open this page from the cards list.
          </p>
        </Card>
      )}

      <section>
        <h2 className="text-sm font-semibold text-foreground mb-3">Status</h2>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-2xl" />
              ))}
            </div>
          ) : error ? (
            <Card className="p-5 border-destructive/30 bg-destructive/5">
              <p className="text-sm font-medium text-destructive mb-1">Failed to load</p>
              <p className="text-xs text-muted-foreground break-all">{error}</p>
            </Card>
          ) : !txns || txns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions found.</p>
          ) : (
            <div className="space-y-3">
              {txns.map((t, i) => (
                <TransactionCard key={i} item={t} variant="compact" />
              ))}
            </div>
          )}
        </section>
      </main>
      <PageFooter />
    </div>
  );
};

export default CardDetails;
