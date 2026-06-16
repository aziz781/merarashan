import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WhatsAppTile } from "@/components/WhatsAppTile";
import { extractItems, isTruthy } from "@/lib/itemUtils";
import { CreditCard, ArrowLeftRight, User, FileText } from "lucide-react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { SideMenu } from "@/components/SideMenu";
import { SlideInPanel } from "@/components/SlideInPanel";
import { LoadingState } from "@/components/LoadingState";
import { toast } from "@/hooks/use-toast";
import { useResource, type Resource } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import type { Customer } from "@/types/domain";
import meraRashanLogo from "@/assets/mera-rashan-logo.webp";
import { PageFooter } from "@/components/PageFooter";

// Lazy-load the four primary tab views so each tab's code (and its
// dependencies — virtualizer, stat components, etc.) ships in its own chunk.
const RashansView = lazy(() => import("@/views/RashansView").then((m) => ({ default: m.RashansView })));
const StatementsView = lazy(() => import("@/views/StatementsView").then((m) => ({ default: m.StatementsView })));
const CardsView = lazy(() => import("@/views/CardsView").then((m) => ({ default: m.CardsView })));
const ProfileView = lazy(() => import("@/views/ProfileView").then((m) => ({ default: m.ProfileView })));


import { NotificationToggle } from "@/components/NotificationToggle";
import { AppVersionInfo } from "@/components/AppVersionInfo";
import { subscribeNotifications, syncNotificationInbox, unreadCount } from "@/lib/notificationsStore";

const STORAGE_KEY = "mr_mobile";
const PHONE_EMAIL_DOMAIN = "phone.merarashan.local";

// Lazy-load the login screen (and its zod schema) so unauthenticated-only
// code stays out of the main bundle for already-signed-in users.
const Login = lazy(() => import("./Login"));

function ResourceView({
  resource,
  mobile,
  onNavigate,
}: {
  resource: Resource;
  mobile: string;
  onNavigate?: (r: Resource) => void;
}) {
  if (resource === "transactions") return <RashansView mobile={mobile} />;
  if (resource === "statements") return <StatementsView mobile={mobile} />;
  if (resource === "customers") return <ProfileView mobile={mobile} onNavigate={onNavigate} />;
  return <CardsView resource={resource} mobile={mobile} />;
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




  const slideInClosingRef = useRef(false);
  const closeWithGuard = useCallback((setter: (v: boolean) => void) => (open: boolean) => {
    if (!open) {
      slideInClosingRef.current = true;
      window.setTimeout(() => {
        slideInClosingRef.current = false;
      }, 400);
    }
    setter(open);
  }, []);
  const handleProfilePanelChange = useCallback(closeWithGuard(setProfileOpen), [closeWithGuard]);
  const handleHelpPanelChange = useCallback(closeWithGuard(setHelpOpen), [closeWithGuard]);
  const handleSettingsPanelChange = useCallback(closeWithGuard(setSettingsOpen), [closeWithGuard]);
  const { data: customerRaw } = useResource<unknown>("customers", mobile ?? undefined);
  const profileData: Customer | null = (() => {
    if (!customerRaw) return null;
    const items = extractItems(customerRaw);
    const first = (items && items[0]) || customerRaw;
    return first as Customer;
  })();

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
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) setMobile(saved);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const handleLogin = useCallback((m: string) => {
    localStorage.setItem(STORAGE_KEY, m);
    setMobile(m);
    toast({ title: "Welcome", description: `Signed in as ${m}` });
  }, []);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    localStorage.removeItem(STORAGE_KEY);
    setMobile(null);
    // profileData clears automatically via useResource when mobile becomes null
  }, []);

  const handleMenuOpenChange = useCallback(
    (open: boolean) => {
      if (!open && (profileOpen || helpOpen || settingsOpen || slideInClosingRef.current)) return;
      setMenuOpen(open);
    },
    [profileOpen, helpOpen, settingsOpen],
  );
  const handleOpenProfile = useCallback(() => {
    setHelpOpen(false);
    setProfileOpen(true);
  }, []);
  const handleOpenHelp = useCallback(() => {
    setProfileOpen(false);
    setHelpOpen(true);
  }, []);
  const handleOpenSettings = useCallback(() => {
    setProfileOpen(false);
    setHelpOpen(false);
    setSettingsOpen(true);
  }, []);
  const handleMenuLogout = useCallback(() => {
    setMenuOpen(false);
    handleLogout();
  }, [handleLogout]);

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
  const isActive = isTruthy(profileData?.is_active);

  return (
    <div className="min-h-screen pb-32">
      <header
        className="px-5 pt-10 pb-6 text-primary-foreground"
        style={{ background: "var(--gradient-primary)", minHeight: 132 }}
      >
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
            <div className="min-w-0 min-h-[44px]">
              <h1 className="text-xl font-bold leading-tight truncate">{tab === "transactions" ? "Monthly Rashans" : tab === "cards" ? "Rashan Cards" : tab === "statements" ? "Monthly Statements" : String(displayName)}</h1>
              {tab === "customers" && (
                <span
                  className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium min-h-[18px] ${
                    !profileData
                      ? "bg-white/10 text-white/0 ring-1 ring-white/10"
                      : isActive
                      ? "bg-green-400/20 text-green-50 ring-1 ring-green-300/40"
                      : "bg-red-400/20 text-red-50 ring-1 ring-red-300/40"
                  }`}
                  aria-hidden={!profileData}
                >
                  {profileData && (
                    <>
                      <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-green-300" : "bg-red-300"}`} />
                      {isActive ? "Active" : "Inactive"}
                    </>
                  )}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>


      <SideMenu
        open={menuOpen}
        onOpenChange={handleMenuOpenChange}
        displayName={String(displayName)}
        payerId={profileData?.payer_id as string | number | null | undefined}
        onOpenProfile={handleOpenProfile}
        onOpenHelp={handleOpenHelp}
        onOpenSettings={handleOpenSettings}
        onLogout={handleMenuLogout}
      />

      <main className="px-5 pt-5">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Resource)} className="w-full">
          {TABS.map(({ id }) => (
            <TabsContent key={id} value={id} className="mt-0">
              <Suspense fallback={<LoadingState label="Loading…" />}>
                <ResourceView resource={id} mobile={mobile} onNavigate={setTab} />
              </Suspense>
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

      <SlideInPanel
        open={profileOpen}
        onOpenChange={handleProfilePanelChange}
        title="Profile"
      >
        <Suspense fallback={<LoadingState label="Loading…" />}>
          <ProfileView mobile={mobile} profileOnly />
        </Suspense>
      </SlideInPanel>

      <SlideInPanel
        open={helpOpen}
        onOpenChange={handleHelpPanelChange}
        title="Help & Support"
        description="Get instant help from our virtual agent 24/7. Live support: Mon-Sun 06:00-18:00 (UTC)"
      >
        <div className="space-y-3 pt-2">
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
      </SlideInPanel>

      <SlideInPanel
        open={settingsOpen}
        onOpenChange={handleSettingsPanelChange}
        title="Settings"
      >
        <div className="space-y-3 pt-2">
          <NotificationToggle mobile={mobile} />
        </div>
      </SlideInPanel>
    </div>
  );
};

export default Index;
