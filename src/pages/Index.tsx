import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Loader2, LogOut, CreditCard, ArrowLeftRight, User, FileText, Phone, FileDown, ExternalLink, Info, CheckCircle2, X, MessageCircle, AlertTriangle, LayoutGrid, List } from "lucide-react";
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
import meraRashanLogo from "@/assets/mera-rashan-logo.png";
import { TransactionStats } from "@/components/TransactionStats";
import { TransactionCard } from "@/components/TransactionCard";
import { TransactionFilters, type TxnFilters } from "@/components/TransactionFilters";
import { StatementStats } from "@/components/StatementStats";
import { PageFooter } from "@/components/PageFooter";
import { MessageBox } from "@/components/MessageBox";
import { InstallAppLinks } from "@/components/InstallAppLinks";
import { NotificationToggle } from "@/components/NotificationToggle";

const STORAGE_KEY = "mr_mobile";
const PHONE_EMAIL_DOMAIN = "phone.merarashan.local";

const mobileSchema = z
  .string()
  .min(6, "Enter a valid mobile number.")
  .max(15, "Too long")
  .regex(/^\d+$/, "Digits only");

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

  const entries = Object.entries(item).filter(
    ([, v]) => v !== null && v !== "" && typeof v !== "object",
  );

  const labelMap: Record<string, string> = {
    person_name: "Name",
    cm_card_number: "Card Number",
    mobile_number: "Mobile",
    city: "City",
    reg_date: "Registration Date",
    amount: "Amount",
    card_name: "Card Type",
    active_cards: "Active Cards",
    status: "Status",
    created_at: "Created At",
    updated_at: "Updated At",
  };

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
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Card Details
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          {entries.map(([key, value], i) => (
            <div key={key}>
              <div className="flex justify-between gap-3 text-sm items-start">
                <span className="text-muted-foreground shrink-0">{labelMap[key] || key.replace(/_/g, " ")}</span>
                <span className="font-medium text-foreground text-right break-all">{formatValue(key, value)}</span>
              </div>
              {i < entries.length - 1 && <Separator className="mt-3" />}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Login({ onLogin }: { onLogin: (m: string) => void }) {
  const [step, setStep] = useState<"mobile" | "otp">("mobile");
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const sendOtp = async (m: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-otp`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ mobile: m }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to send code");
      setStep("otp");
      toast({ title: "Code sent", description: `OTP sent to ${m}` });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send code");
    } finally {
      setLoading(false);
    }
  };

  const submitMobile = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = formatMobile(mobile);
    const parsed = mobileSchema.safeParse(cleaned);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setMobile(cleaned);
    sendOtp(cleaned);
  };

  const submitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-otp`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ mobile, code }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Verification failed");
      if (!data?.token_hash) throw new Error("Missing session token");
      const { error: vErr } = await supabase.auth.verifyOtp({
        token_hash: data.token_hash,
        type: "magiclink",
      });
      if (vErr) throw new Error(vErr.message);
      onLogin(mobile);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-5">
      <Card className="w-full max-w-sm p-8 shadow-[var(--shadow-card)] border-0 bg-card/80 backdrop-blur">
        <img
          src={meraRashanLogo}
          alt="Mera Rashan Card"
          className="w-32 h-32 mx-auto mb-4 object-contain"
        />
        <h1 className="sr-only">Mera Rashan</h1>
        <p className="text-sm text-muted-foreground text-center mt-1 mb-6">
          {step === "mobile" ? "Sign in with your mobile number" : `Enter the code sent to ${mobile}`}
        </p>
        {step === "mobile" ? (
          <form onSubmit={submitMobile} className="space-y-3">
            <Input
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              maxLength={15}
              placeholder="923030812222"
              value={mobile}
              onChange={(e) => {
                setMobile(e.target.value.replace(/\D/g, ""));
                setError(null);
              }}
              className="h-12 text-base text-left"
              disabled={loading}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold text-primary-foreground border-0 hover:opacity-90"
              style={{ background: "var(--gradient-primary)" }}
              disabled={loading}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send code"}
            </Button>
          </form>
        ) : (
          <form onSubmit={submitOtp} className="space-y-3">
            <Input
              type="tel"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="6-digit code"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, ""));
                setError(null);
              }}
              className="h-12 text-base text-center tracking-[0.4em] font-semibold"
              disabled={loading}
              autoFocus
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & continue"}
            </Button>
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => { setStep("mobile"); setCode(""); setError(null); }}
                disabled={loading}
              >
                Change number
              </button>
              <button
                type="button"
                className="text-primary font-medium hover:underline"
                onClick={() => sendOtp(mobile)}
                disabled={loading}
              >
                Resend code
              </button>
            </div>
          </form>
        )}
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
        <span className="inline-flex items-center gap-1.5 font-medium">
          Active
          <CheckCircle2 className="w-4 h-4 text-green-500" />
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 font-medium">
          Inactive
          <X className="w-4 h-4 text-destructive" />
        </span>
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
          <NotificationToggle mobile={mobile} />
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
          <InstallAppLinks />
          {data.msg != null && String(data.msg).trim() !== "" && (
            <MessageBox
              type={String(data.msg_type ?? "")}
              title={data.msg_title ? String(data.msg_title) : undefined}
              message={String(data.msg)}
            />
          )}
          <RecentRashans mobile={mobile} onViewAll={() => onNavigate?.("transactions")} />
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
  const [selected, setSelected] = useState<string>(() => {
    try {
      const v = sessionStorage.getItem("statementsYear");
      if (v) return v;
    } catch (_) { /* ignore */ }
    return String(currentYear);
  });
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    try {
      const v = sessionStorage.getItem("statementsStatus");
      if (v) return v;
    } catch (_) { /* ignore */ }
    return "all";
  });
  useEffect(() => {
    try { sessionStorage.setItem("statementsYear", selected); } catch (_) { /* ignore */ }
  }, [selected]);
  useEffect(() => {
    try { sessionStorage.setItem("statementsStatus", statusFilter); } catch (_) { /* ignore */ }
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
        <p className="text-sm text-muted-foreground text-center py-6">
          No statements found.
        </p>
      ) : (
        filteredItems.map((item, i) => (
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
  const VIEW_KEY = "mr_cards_view";
  const [selected, setSelected] = useState<string>(() => {
    try {
      const v = sessionStorage.getItem("cardsFilter");
      if (v) return v;
    } catch (_) { /* ignore */ }
    return "all";
  });
  useEffect(() => {
    try { sessionStorage.setItem("cardsFilter", selected); } catch (_) { /* ignore */ }
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
        <p className="text-sm text-muted-foreground text-center py-6">
          No cards match the filter.
        </p>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((item, i) => (
            <CardGridTile key={i} item={item} index={i + 1} />
          ))}
        </div>
      ) : (
        filtered.map((item, i) => (
          <RecordCard key={i} resource="cards" mobile={mobile} item={item} index={i + 1} />
        ))
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
  const amount = Number.isFinite(amountNum) && amountRaw != null && amountRaw !== ""
    ? `Rs. ${amountNum.toLocaleString("en-PK")}`
    : "—";
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
      className="p-3 border-0 bg-primary text-primary-foreground shadow-[var(--shadow-card)] cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-mono opacity-90">{String(index).padStart(2, "0")}</span>
        <CreditCard className="w-4 h-4 opacity-90" />
      </div>
      <p className="text-base font-bold leading-tight break-words mb-1">{name}</p>
      <p className="text-sm font-bold mb-2">{amount}</p>
      {rcNum && (
        <p className="text-[11px] opacity-75 break-all font-serif">{rcNum}</p>
      )}
    </Card>
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
    } catch (_) { /* ignore */ }
    return { status: "all", validFrom: `${currentMonth}/${currentYear}` };
  });

  useEffect(() => {
    try {
      sessionStorage.setItem("rashanFilters", JSON.stringify(filters));
    } catch (_) { /* ignore */ }
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
            <p className="text-sm text-muted-foreground text-center py-6">
              No transactions match the filters.
            </p>
          ) : (
            filtered.map((item, i) => <TransactionCard key={i} item={item} origin="rashans" />)
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
  index,
}: {
  resource: Resource;
  mobile: string;
  item: Record<string, unknown>;
  index?: number;
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
        className="p-5 border-0 bg-primary text-primary-foreground shadow-[var(--shadow-card)] cursor-pointer transition-transform hover:scale-[1.01] active:scale-[0.99]"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {index != null && (
              <span className="text-sm font-mono opacity-90">{String(index).padStart(2, "0")}</span>
            )}
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
              display = Number.isFinite(n)
                ? `Rs. ${n.toLocaleString("en-PK")}`
                : String(raw);
            } else {
              display = String(raw);
            }
            const isBold = key === "person_name" || key === "amount";
            const hideLabel = key === "person_name" || key === "amount";
            const isName = key === "person_name";
            return (
              <div key={key} className={`flex justify-between ${isName ? "" : "text-sm"}`}>
                {!hideLabel && (
                  <span className={`${isBold ? "font-bold" : "opacity-75"}`}>{label}</span>
                )}
                <span className={`text-right break-all ${isBold ? "font-bold" : "opacity-75"} ${hideLabel ? "w-full text-left" : ""} ${isName ? "text-xl" : ""}`}>
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
  const [tab, setTab] = useState<Resource>(() => {
    try {
      const saved = sessionStorage.getItem("activeTab");
      if (saved) return saved as Resource;
    } catch (_) { /* ignore */ }
    return "customers";
  });
  useEffect(() => {
    try { sessionStorage.setItem("activeTab", tab); } catch (_) { /* ignore */ }
  }, [tab]);
  const [profileOpen, setProfileOpen] = useState(false);
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

  if (!mobile) return <Login onLogin={handleLogin} />;

  const displayName = profileData?.contact_person || `+${mobile}`;
  const isActive =
    profileData?.is_active === true ||
    profileData?.is_active === "true" ||
    profileData?.is_active === 1 ||
    profileData?.is_active === "1";

  return (
    <div className="min-h-screen pb-24">
      <header
        className="px-5 pt-10 pb-6 text-primary-foreground"
        style={{ background: "var(--gradient-primary)" }}
      >
        <div className="flex items-start justify-between">
          <div>
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded-md"
              aria-label="Open profile"
            >
              {profileData?.payer_id && (
                <p className="text-xs opacity-75">{String(profileData.payer_id)}</p>
              )}
              <h1 className="text-2xl font-bold hover:underline underline-offset-4 flex items-center gap-2">
                {String(displayName)}
                {profileData && (
                  <span title={isActive ? "Active" : "Inactive"}>
                    {isActive ? (
                      <CheckCircle2 className="w-5 h-5 text-green-400" />
                    ) : (
                      <X className="w-5 h-5 text-red-400" />
                    )}
                  </span>
                )}
              </h1>
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

      <PageFooter />

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mera Rashan</DialogTitle>
          </DialogHeader>
          <ProfileView mobile={mobile} profileOnly />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
