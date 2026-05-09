import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Loader2, LogOut, CreditCard, ArrowLeftRight, User, FileText, Phone, FileDown, ExternalLink, Info, CheckCircle2, X, MessageCircle, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { fetchResource, formatMobile, Resource } from "@/lib/api";
import { TransactionStats } from "@/components/TransactionStats";
import { TransactionCard } from "@/components/TransactionCard";
import { TransactionFilters, type TxnFilters } from "@/components/TransactionFilters";
import { StatementStats } from "@/components/StatementStats";

const STORAGE_KEY = "mr_mobile";

const mobileSchema = z
  .string()
  .min(6, "Too short")
  .max(15, "Too long")
  .regex(/^\d+$/, "Digits only");

function Login({ onLogin }: { onLogin: (m: string) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = formatMobile(value);
    const parsed = mobileSchema.safeParse(cleaned);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    onLogin(cleaned);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-5">
      <Card className="w-full max-w-sm p-8 shadow-[var(--shadow-card)] border-0 bg-card/80 backdrop-blur">
        <div
          className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center"
          style={{ background: "var(--gradient-primary)" }}
        >
          <CreditCard className="w-7 h-7 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-center text-foreground">Mera Rashan</h1>
        <p className="text-sm text-muted-foreground text-center mt-1 mb-6">
          Sign in with your mobile number
        </p>
        <form onSubmit={submit} className="space-y-3">
          <Input
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            maxLength={15}
            placeholder="923030812222"
            value={value}
            onChange={(e) => {
              setValue(e.target.value.replace(/\D/g, ""));
              setError(null);
            }}
            className="h-12 text-base text-left"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" className="w-full h-12 text-base font-semibold">
            Continue
          </Button>
        </form>
      </Card>
    </div>
  );
}

function ResourceView({ resource, mobile, onNavigate }: { resource: Resource; mobile: string; onNavigate?: (r: Resource) => void }) {
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

function RecentRashans({ mobile, onViewAll }: { mobile: string; onViewAll?: () => void }) {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchResource("transactions", mobile)
      .then((d) => {
        if (cancelled) return;
        const list = (extractItems(d) ?? []) as Record<string, unknown>[];
        setItems(list);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [mobile]);

  const latest = [...items]
    .sort((a, b) => {
      const da = new Date(String(a.created_at ?? a.date ?? a.txn_date ?? a.valid_from ?? 0)).getTime();
      const db = new Date(String(b.created_at ?? b.date ?? b.txn_date ?? b.valid_from ?? 0)).getTime();
      return db - da;
    })
    .slice(0, 3);

  return (
    <Card className="p-4 bg-card/80 backdrop-blur shadow-[var(--shadow-soft)] border-border/50">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Recent Rashans</p>
        <button
          type="button"
          onClick={onViewAll}
          className="text-xs font-medium text-primary hover:underline"
        >
          View all
        </button>
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

function ProfileView({ mobile, onNavigate, profileOnly = false }: { mobile: string; onNavigate?: (r: Resource) => void; profileOnly?: boolean }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        <CheckCircle2 className="w-5 h-5 text-green-500" />
      ) : (
        <X className="w-5 h-5 text-destructive" />
      );
    } else if (key === "active_cards") {
      display = <Badge variant="default" className="font-normal">{String(raw)}</Badge>;
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
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-bold">PROFILE</p>
            <div className="space-y-1.5">{section1.map(renderRow)}</div>
          </Card>
          <a
            href="https://wa.me/923030812222"
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <Card className="p-4 bg-[#25D366]/10 border-[#25D366]/30 shadow-[var(--shadow-soft)] cursor-pointer transition-transform hover:scale-[1.01] active:scale-[0.99]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center shrink-0">
                  <MessageCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Contact Support</p>
                  <p className="text-xs text-muted-foreground">Chat on WhatsApp</p>
                </div>
              </div>
            </Card>
          </a>
        </>
      )}
      {!profileOnly && (
        <>
          <Card
            role="button"
            tabIndex={0}
            onClick={() => onNavigate?.("cards")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onNavigate?.("cards");
              }
            }}
            className="p-4 bg-card/80 backdrop-blur shadow-[var(--shadow-soft)] border-border/50 cursor-pointer transition-transform hover:scale-[1.01] active:scale-[0.99]"
          >
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-bold">CARDS</p>
            <div className="space-y-1.5">{section2.map(renderRow)}</div>
          </Card>
          {data.msg != null && String(data.msg).trim() !== "" && (
            <Card className="p-4 border-primary/30 bg-primary/5 shadow-[var(--shadow-soft)]">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs uppercase tracking-wider text-primary mb-1 font-semibold">Message</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap break-words">{String(data.msg)}</p>
                </div>
              </div>
            </Card>
          )}
          <RecentRashans mobile={mobile} onViewAll={() => onNavigate?.("transactions")} />
          <div className="flex flex-col items-center text-center pt-2 pb-1">
            <ShieldCheck className="w-5 h-5 text-muted-foreground mb-1" />
            <p className="text-sm font-semibold text-muted-foreground">MeraRashan.pk</p>
            <p className="text-xs text-muted-foreground">Safe and transparent service in every step of the way.</p>
          </div>
        </>
      )}
    </div>
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
  const [selected, setSelected] = useState<string>(String(currentYear));
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

  return (
    <div className="space-y-3">
      <StatementStats items={items} stats={stats} />
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
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          No statements found.
        </p>
      ) : (
        items.map((item, i) => (
          <RecordCard key={i} resource="statements" mobile={mobile} item={item} />
        ))
      )}
    </div>
  );
}

function CardsList({
  items,
  mobile,
}: {
  items: Record<string, unknown>[];
  mobile: string;
}) {
  const [selected, setSelected] = useState<string>("all");
  const names = Array.from(
    new Set(
      items
        .map((it) => String(it.person_name ?? "").trim())
        .filter((n) => n.length > 0),
    ),
  ).sort();
  const filtered =
    selected === "all"
      ? items
      : items.filter((it) => String(it.person_name ?? "") === selected);

  return (
    <div className="space-y-3">
      <Select value={selected} onValueChange={setSelected}>
        <SelectTrigger className="h-11">
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
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          No cards match the filter.
        </p>
      ) : (
        filtered.map((item, i) => (
          <RecordCard key={i} resource="cards" mobile={mobile} item={item} />
        ))
      )}
    </div>
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
  const [filters, setFilters] = useState<TxnFilters>({ status: "all", validFrom: `${currentMonth}/${currentYear}` });
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params: Record<string, string> = {};
    const m = filters.validFrom.match(/^(\d{2})\/(\d{4})$/);
    if (m) {
      params.month = m[1];
      params.year = m[2];
    }

    fetchResource("transactions", mobile, params)
      .then((d) => {
        if (cancelled) return;
        const list = (extractItems(d) ?? []) as Record<string, unknown>[];
        setItems(list);
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
      <TransactionStats items={filtered} />
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
            <p className="text-sm text-muted-foreground text-center py-6">
              No transactions match the filters.
            </p>
          ) : (
            filtered.map((item, i) => <TransactionCard key={i} item={item} />)
          )}
        </div>
      )}
    </>
  );
}
function StatementPdfButton({ url, title }: { url: string; title: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full mt-3"
        onClick={() => setOpen(true)}
      >
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
                  <a
                    href={url}
                    download={`${title}.pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
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
}: {
  resource: Resource;
  mobile: string;
  item: Record<string, unknown>;
}) {
  const navigate = useNavigate();
  const entries = Object.entries(item).filter(
    ([, v]) => v !== null && v !== "" && typeof v !== "object",
  );

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
    const open = () => {
      if (rcNum) navigate(`/cards/${encodeURIComponent(rcNum)}`, { state: { card: item } });
    };
    return (
      <Card
        role="button"
        tabIndex={0}
        onClick={open}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open();
          }
        }}
        className="p-5 border-0 text-primary-foreground shadow-[var(--shadow-card)] cursor-pointer transition-transform hover:scale-[1.01] active:scale-[0.99]"
        style={{ background: "var(--gradient-card)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <CreditCard className="w-6 h-6 opacity-90" />
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
              display = Number.isFinite(n)
                ? `Rs. ${n.toLocaleString("en-PK")}`
                : String(raw);
            } else {
              display = String(raw);
            }
            const isBold = key === "person_name" || key === "amount";
            return (
              <div key={key} className="flex justify-between text-sm">
                <span className={`opacity-75 ${isBold ? "font-bold" : ""}`}>{label}</span>
                <span className={`text-right break-all ${isBold ? "font-bold" : ""}`}>
                  {display}
                </span>
              </div>
            );
          })}
        </div>
      </Card>
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
              display = Number.isFinite(n)
                ? `Rs. ${n.toLocaleString("en-PK")}`
                : String(raw);
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
                <span className="font-medium text-foreground text-right break-all">
                  {display}
                </span>
              </div>
            );
          })}
        </div>
        {fileUrl && (
          <StatementPdfButton url={fileUrl} title={String(item.statement_period ?? "Statement")} />
        )}
      </Card>
    );
  }

  return (
    <Card className="p-4 bg-card/80 backdrop-blur shadow-[var(--shadow-soft)] border-border/50">
      <div className="space-y-1.5">
        {entries.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 text-sm">
            <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</span>
            <span className="font-medium text-foreground text-right break-all">
              {String(v)}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

const TABS: { id: Resource; label: string; icon: typeof CreditCard }[] = [
  { id: "customers", label: "Home", icon: User },
  { id: "cards", label: "Cards", icon: CreditCard },
  { id: "transactions", label: "Rashans", icon: ArrowLeftRight },
  { id: "statements", label: "Statements", icon: FileText },
];

const Index = () => {
  const [mobile, setMobile] = useState<string | null>(null);
  const [tab, setTab] = useState<Resource>("customers");
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setMobile(saved);
  }, []);

  const handleLogin = (m: string) => {
    localStorage.setItem(STORAGE_KEY, m);
    setMobile(m);
    toast({ title: "Welcome", description: `Signed in as ${m}` });
  };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setMobile(null);
  };

  if (!mobile) return <Login onLogin={handleLogin} />;

  return (
    <div className="min-h-screen pb-24">
      <header
        className="px-5 pt-10 pb-6 text-primary-foreground"
        style={{ background: "var(--gradient-primary)" }}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider opacity-75">Signed in</p>
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded-md"
              aria-label="Open profile"
            >
              <h1 className="text-2xl font-bold mt-1 hover:underline underline-offset-4">+{mobile}</h1>
            </button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="text-primary-foreground hover:bg-white/10"
            aria-label="Log out"
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="px-5 -mt-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Resource)} className="w-full">
          <TabsList className="grid grid-cols-4 w-full h-14 bg-card shadow-[var(--shadow-soft)] rounded-2xl p-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <TabsTrigger
                key={id}
                value={id}
                className="flex flex-col gap-0.5 h-full rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Icon className="w-4 h-4" />
                <span className="text-[10px] font-medium">{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {TABS.map(({ id }) => (
            <TabsContent key={id} value={id} className="mt-5">
              <ResourceView resource={id} mobile={mobile} onNavigate={setTab} />
            </TabsContent>
          ))}
        </Tabs>
      </main>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Profile</DialogTitle>
          </DialogHeader>
          <ProfileView mobile={mobile} profileOnly />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
