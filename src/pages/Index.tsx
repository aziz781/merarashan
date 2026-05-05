import { useEffect, useState } from "react";
import { z } from "zod";
import { Loader2, LogOut, CreditCard, ArrowLeftRight, User, FileText, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { fetchResource, formatMobile, Resource } from "@/lib/api";

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
          <Phone className="w-7 h-7 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-center text-foreground">Mera Rashan</h1>
        <p className="text-sm text-muted-foreground text-center mt-1 mb-6">
          Sign in with your mobile number
        </p>
        <form onSubmit={submit} className="space-y-3">
          <Input
            inputMode="numeric"
            placeholder="447525776781"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            className="h-12 text-base"
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

function ResourceView({ resource, mobile }: { resource: Resource; mobile: string }) {
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

  const items = Array.isArray(data)
    ? data
    : Array.isArray((data as { data?: unknown[] })?.data)
      ? (data as { data: unknown[] }).data
      : null;

  if (!items || items.length === 0) {
    // Render single object or empty
    return (
      <Card className="p-5">
        <pre className="text-xs whitespace-pre-wrap break-all text-muted-foreground">
          {JSON.stringify(data, null, 2)}
        </pre>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <RecordCard key={i} resource={resource} item={item as Record<string, unknown>} />
      ))}
    </div>
  );
}

function RecordCard({
  resource,
  item,
}: {
  resource: Resource;
  item: Record<string, unknown>;
}) {
  const entries = Object.entries(item).filter(
    ([, v]) => v !== null && v !== "" && typeof v !== "object",
  );

  if (resource === "cards") {
    return (
      <Card
        className="p-5 border-0 text-primary-foreground shadow-[var(--shadow-card)]"
        style={{ background: "var(--gradient-card)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <CreditCard className="w-6 h-6 opacity-90" />
          <span className="text-xs uppercase tracking-wider opacity-75">Card</span>
        </div>
        <div className="space-y-1">
          {entries.slice(0, 4).map(([k, v]) => (
            <div key={k} className="flex justify-between text-sm">
              <span className="opacity-75">{k}</span>
              <span className="font-medium">{String(v)}</span>
            </div>
          ))}
        </div>
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
  { id: "cards", label: "Cards", icon: CreditCard },
  { id: "transactions", label: "Transactions", icon: ArrowLeftRight },
  { id: "customers", label: "Profile", icon: User },
  { id: "statements", label: "Statements", icon: FileText },
];

const Index = () => {
  const [mobile, setMobile] = useState<string | null>(null);

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
            <h1 className="text-2xl font-bold mt-1">+{mobile}</h1>
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
        <Tabs defaultValue="cards" className="w-full">
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
              <ResourceView resource={id} mobile={mobile} />
            </TabsContent>
          ))}
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
