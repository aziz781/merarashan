import { Suspense, useCallback, useEffect, useRef, useState } from "react";

// Detect native iOS (Capacitor) so the top title bar gets extra height to
// clear the taller iOS status bar / notch.
const isNativeIOSPlatform =
  typeof window !== "undefined" &&
  ((window as unknown as { Capacitor?: { getPlatform?: () => string } })
    .Capacitor?.getPlatform?.() === "ios");

import { lazyWithRetry as lazy } from "@/lib/lazyWithRetry";
import { useNavigate } from "react-router-dom";
import { WhatsAppTile } from "@/components/WhatsAppTile";
import { extractItems, isTruthy } from "@/lib/itemUtils";
import { CreditCard, ArrowLeftRight, User, FileText, Instagram, Facebook, ShieldCheck, ScrollText, BarChart3, Trash2, Snowflake, AlertTriangle, Lock, Unlock, Sun, Moon, X, Check } from "lucide-react";

import { SideMenu } from "@/components/SideMenu";
import { SlideInPanel } from "@/components/SlideInPanel";
import { DeleteAccountSection } from "@/components/DeleteAccountSection";
import { LoadingState } from "@/components/LoadingState";
import { toast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { useResource, clearResourcesCache, clearAllAppCache, ApiError, type Resource } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import type { Customer } from "@/types/domain";
import meraRashanLogo from "@/assets/mera-rashan-logo.webp";
import { PageFooter } from "@/components/PageFooter";

// Lazy-load the four primary tab views so each tab's code (and its
// dependencies — virtualizer, stat components, etc.) ships in its own chunk.
// Keep module loaders separately so we can also warm them on idle.
const loadRashansView = () => import("@/views/RashansView");
const loadStatementsView = () => import("@/views/StatementsView");
const loadCardsView = () => import("@/views/CardsView");
const loadProfileView = () => import("@/views/ProfileView");

const RashansView = lazy(() => loadRashansView().then((m) => ({ default: m.RashansView })));
const StatementsView = lazy(() => loadStatementsView().then((m) => ({ default: m.StatementsView })));
const CardsView = lazy(() => loadCardsView().then((m) => ({ default: m.CardsView })));
const ProfileView = lazy(() => loadProfileView().then((m) => ({ default: m.ProfileView })));

// Map tab id → loaders for sibling chunks we want to warm in the background
// once the active tab has finished mounting. Keeps tab switches instant
// without inflating the initial bundle.
const TAB_PRELOADERS: Record<string, Array<() => Promise<unknown>>> = {
  customers: [loadRashansView, loadCardsView, loadStatementsView],
  transactions: [loadCardsView, loadStatementsView, loadProfileView],
  cards: [loadRashansView, loadStatementsView, loadProfileView],
  statements: [loadRashansView, loadCardsView, loadProfileView],
};

type IdleScheduler = (cb: () => void, opts?: { timeout?: number }) => number;
const scheduleIdle: IdleScheduler =
  typeof window !== "undefined" &&
  typeof (window as unknown as { requestIdleCallback?: IdleScheduler }).requestIdleCallback === "function"
    ? (window as unknown as { requestIdleCallback: IdleScheduler }).requestIdleCallback.bind(window)
    : ((cb: () => void) => window.setTimeout(cb, 200) as unknown as number);


import { NotificationToggle } from "@/components/NotificationToggle";
import { PostLoginNotificationPrompt } from "@/components/PostLoginNotificationPrompt";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "@/hooks/use-theme";
import { AccessibilitySettings } from "@/components/AccessibilitySettings";

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
  { id: "statements", label: "Statements", icon: FileText },
  { id: "cards", label: "Cards", icon: CreditCard },
];

const Index = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
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

  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);

  // Warm sibling tab chunks in the background so tapping a tab feels instant.
  useEffect(() => {
    if (!mobile) return;
    const loaders = TAB_PRELOADERS[tab] ?? [];
    const handle = scheduleIdle(
      () => {
        loaders.forEach((load) => {
          load().catch(() => { /* ignore */ });
        });
      },
      { timeout: 2000 },
    );
    return () => {
      try {
        (window as unknown as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback?.(handle);
      } catch { /* ignore */ }
    };
  }, [tab, mobile]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [socialOpen, setSocialOpen] = useState(false);
  const [sponsorProfileOpen, setSponsorProfileOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
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
  const handlePrivacyPanelChange = useCallback(closeWithGuard(setPrivacyOpen), [closeWithGuard]);
  const handleSocialPanelChange = useCallback(closeWithGuard(setSocialOpen), [closeWithGuard]);
  const handleDeleteAccountPanelChange = useCallback(closeWithGuard(setDeleteAccountOpen), [closeWithGuard]);
  const { data: customerRaw, error: customerError } = useResource<unknown>("customers", mobile ?? undefined, undefined, { retry: false });
  const profileData: Customer | null = (() => {
    if (!customerRaw) return null;
    const items = extractItems(customerRaw);
    const first = (items && items[0]) || customerRaw;
    return first as Customer;
  })();

  // Any 403/404 "account does not exist" on the primary customers fetch means
  // the user is signed in but the upstream account is gone (deleted, deactivated,
  // never existed via bypass). Sign out cleanly and route them back to Login,
  // which will render the dedicated account_not_found UI.
  const accountMissingHandledRef = useRef(false);
  useEffect(() => {
    if (!customerError || accountMissingHandledRef.current) return;
    const isAccountMissing = customerError instanceof ApiError && customerError.code === "account_not_found";
    if (!isAccountMissing) return;
    accountMissingHandledRef.current = true;
    const lastMobile = mobile;
    (async () => {
      try {
        if (lastMobile) localStorage.setItem("mr_account_not_found", lastMobile);
      } catch { /* ignore */ }
      clearAllAppCache();
      try { await supabase.auth.signOut(); } catch { /* ignore */ }
      localStorage.removeItem(STORAGE_KEY);
      setMobile(null);
      sonnerToast.error("Account not found", {
        description: "We couldn't find your Mera Rashan account. Please contact support.",
      });
    })();
  }, [customerError, mobile]);

  const isCustomerActive = isTruthy(profileData?.is_active);
  const PAYER_ID_KEY = "mr_payer_id";
  useEffect(() => {
    if (profileData?.payer_id != null) {
      try { localStorage.setItem(PAYER_ID_KEY, String(profileData.payer_id)); } catch { /* ignore */ }
    }
  }, [profileData?.payer_id]);
  const resolvePayerId = useCallback(() => {
    if (profileData?.payer_id != null) return String(profileData.payer_id);
    try { return localStorage.getItem(PAYER_ID_KEY) ?? ""; } catch { return ""; }
  }, [profileData?.payer_id]);


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
        // App started with an already-signed-in user — check & ask for push
        // notification permission (the prompt itself skips if permission is
        // already granted or the user dismissed it this session).
        setShowNotificationPrompt(true);
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
    setShowNotificationPrompt(true);
  }, []);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    // Wipe cached customer/API responses so the next login starts clean.
    clearAllAppCache();
    localStorage.removeItem(STORAGE_KEY);
    setMobile(null);
    // profileData clears automatically via useResource when mobile becomes null
  }, []);

  const handleMenuOpenChange = useCallback(
    (open: boolean) => {
      if (!open && (profileOpen || helpOpen || settingsOpen || privacyOpen || socialOpen || deleteAccountOpen || slideInClosingRef.current)) return;
      setMenuOpen(open);
    },
    [profileOpen, helpOpen, settingsOpen, privacyOpen, socialOpen, deleteAccountOpen],
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
  const handleOpenPrivacy = useCallback(() => {
    setProfileOpen(false);
    setHelpOpen(false);
    setSettingsOpen(false);
    setPrivacyOpen(true);
  }, []);
  const handleOpenSocial = useCallback(() => {
    setProfileOpen(false);
    setHelpOpen(false);
    setSettingsOpen(false);
    setPrivacyOpen(false);
    setSocialOpen(true);
  }, []);
  const handleOpenDeleteAccount = useCallback(() => {
    setProfileOpen(false);
    setHelpOpen(false);
    setSettingsOpen(false);
    setPrivacyOpen(false);
    setSocialOpen(false);
    setDeleteAccountOpen(true);
  }, []);
  const [unfreezing, setUnfreezing] = useState(false);
  const [unfreezeConfirmOpen, setUnfreezeConfirmOpen] = useState(false);
  const [freezing, setFreezing] = useState(false);
  const [freezeConfirmOpen, setFreezeConfirmOpen] = useState(false);
  const [freezeConfirmed, setFreezeConfirmed] = useState(false);
  const [frozenInfoOpen, setFrozenInfoOpen] = useState(false);

  useEffect(() => {
    if (!freezeConfirmOpen) setFreezeConfirmed(false);
  }, [freezeConfirmOpen]);

  const handleFreezeAccount = useCallback(async () => {
    const customerNumber = resolvePayerId();
    if (!customerNumber || !mobile) {
      sonnerToast.error("Freeze failed", {
        description: !mobile ? "Not signed in." : "Customer ID unavailable — please reopen the app.",
      });
      return;
    }

    setFreezing(true);
    const progressId = sonnerToast.loading("Freezing account…");
    try {
      const url = new URL(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/merarashan-proxy`,
      );
      url.searchParams.set("resource", "customers");
      url.searchParams.set("mobile", mobile);
      url.searchParams.set("customerNumber", customerNumber);
      url.searchParams.set("action", "freeze");
      const res = await fetch(url.toString(), {
        method: "PUT",
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Request failed (${res.status}): ${txt}`);
      }
      sonnerToast.success("Account frozen", {
        id: progressId,
        description: "Your account has been temporarily frozen.",
      });
      setPrivacyOpen(false);
      setMenuOpen(false);
      setTab("customers");
      void clearResourcesCache();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Freeze failed";
      sonnerToast.error("Freeze failed", { id: progressId, description: msg });
    } finally {
      setFreezing(false);
    }
  }, [mobile, resolvePayerId]);
  const handleUnfreezeAccount = useCallback(async () => {
    const customerNumber = resolvePayerId();
    if (!customerNumber || !mobile) {
      sonnerToast.error("Unfreeze failed", {
        description: !mobile ? "Not signed in." : "Customer ID unavailable — please reopen the app.",
      });
      return;
    }

    setUnfreezing(true);
    const progressId = sonnerToast.loading("Unfreezing account…");
    try {
      const url = new URL(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/merarashan-proxy`,
      );
      url.searchParams.set("resource", "customers");
      url.searchParams.set("mobile", mobile);
      url.searchParams.set("customerNumber", customerNumber);
      url.searchParams.set("action", "unfreeze");
      const res = await fetch(url.toString(), {
        method: "PUT",
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Request failed (${res.status}): ${txt}`);
      }
      sonnerToast.success("Account unfrozen", {
        id: progressId,
        description: "Your account has been reactivated.",
      });
      setPrivacyOpen(false);
      setMenuOpen(false);
      setTab("customers");
      void clearResourcesCache();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unfreeze failed";
      sonnerToast.error("Unfreeze failed", { id: progressId, description: msg });
    } finally {
      setUnfreezing(false);
    }
  }, [mobile, resolvePayerId]);

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
      <PostLoginNotificationPrompt
        mobile={mobile}
        open={showNotificationPrompt}
        onClose={() => setShowNotificationPrompt(false)}
      />
      <header
        className="px-5 pb-2 text-primary-foreground [background:var(--gradient-primary)] dark:![background:hsl(var(--card)/0.85)] dark:!text-foreground dark:border-b dark:border-border/60 dark:backdrop-blur-md"
        style={{
          paddingTop: isNativeIOSPlatform
            ? "calc(max(env(safe-area-inset-top), 44px) + 1.5rem)"
            : "calc(env(safe-area-inset-top) + 0.75rem)",
          minHeight: isNativeIOSPlatform ? 152 : 88,
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {tab === "customers" && (
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-label="Open menu"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm text-primary-foreground text-sm font-semibold ring-1 ring-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 hover:bg-white/25 transition-colors dark:bg-primary/25 dark:text-primary dark:ring-primary/50 dark:hover:bg-primary/35"
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
            )}
            <div className="min-w-0 min-h-[44px]">
              <h1 className="text-3xl font-bold leading-tight truncate">{tab === "transactions" ? "Rashans" : tab === "cards" ? "Cards" : tab === "statements" ? "Statements" : String(displayName)}</h1>
              {tab === "transactions" && (
                <p className="text-xs text-primary-foreground/80 dark:!text-foreground/70 mt-0.5 truncate">Mera Rashan Details</p>
              )}
              {tab === "cards" && (
                <p className="text-xs text-primary-foreground/80 dark:!text-foreground/70 mt-0.5 truncate">Mera Rashan Card Details</p>
              )}
              {tab === "statements" && (
                <p className="text-xs text-primary-foreground/80 dark:!text-foreground/70 mt-0.5 truncate">Mera Rashan Monthly Statements</p>
              )}
              {tab === "customers" && (
                !profileData ? (
                  <span
                    className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium min-h-[18px] bg-white/10 text-white/0 ring-1 ring-white/10"
                    aria-hidden
                  />
                ) : isActive ? (
                  <button
                    type="button"
                    onClick={() => setSponsorProfileOpen(true)}
                    className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium min-h-[18px] bg-green-400/20 text-green-50 ring-1 ring-green-300/40 hover:bg-green-400/30 transition-colors"
                    aria-label="Sponsor profile. Open details"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-green-300" />
                    Sponsor
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setFrozenInfoOpen(true)}
                    className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium min-h-[18px] bg-red-400/20 text-red-50 ring-1 ring-red-300/40 hover:bg-red-400/30 transition-colors"
                    aria-label="Account frozen. Open unfreeze options"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-red-300" />
                    Frozen account
                    <Lock className="shrink-0" size={10} strokeWidth={2.5} />
                  </button>
                )
              )}
          </div>
        </div>
        {tab === "customers" && (
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm text-primary-foreground ring-1 ring-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 hover:bg-white/25 transition-colors dark:bg-primary/25 dark:text-primary dark:ring-primary/50 dark:hover:bg-primary/35"
          >
            {theme === "dark" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>
        )}
        </div>
      </header>

      <Dialog open={sponsorProfileOpen} onOpenChange={setSponsorProfileOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-0">
            <DialogTitle>Sponsor profile</DialogTitle>
            <DialogDescription>Your account details as a sponsor.</DialogDescription>
          </DialogHeader>
          <div className="p-5">
            {mobile && <ProfileView mobile={mobile} profileOnly={true} />}
          </div>
        </DialogContent>
      </Dialog>


      <SideMenu
        open={menuOpen}
        onOpenChange={handleMenuOpenChange}
        displayName={String(displayName)}
        payerId={profileData?.payer_id as string | number | null | undefined}
        onOpenProfile={handleOpenProfile}
        onOpenHelp={handleOpenHelp}
        onOpenSettings={handleOpenSettings}
        onOpenPrivacy={handleOpenPrivacy}
        onOpenSocial={handleOpenSocial}
        
        onLogout={handleMenuLogout}
      />

      <main className="px-5 pt-5">
        {/* Only the active tab is rendered — keeps inactive view code
            from parsing/running until the user actually opens it. */}
        <Suspense fallback={<LoadingState label="Loading…" />}>
          <ResourceView resource={tab} mobile={mobile} onNavigate={setTab} />
        </Suspense>
      </main>

      <PageFooter />

      {tab === "transactions" && (
        <button
          type="button"
          onClick={() => navigate("/rashans/dashboard")}
          aria-label="Open rashan dashboard"
          className="fixed left-5 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-1 ring-black/5 hover:opacity-90 transition"
          style={{ bottom: "5rem", marginBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <BarChart3 className="h-5 w-5" />
        </button>
      )}


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
            title="@mera.rashan"
            subtitle="Chat on WhatsApp"
          />
          <WhatsAppTile
            href="https://wa.me/923091493053"
            number="923091493053"
            title="@mera.rashan.chatbot"
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
          <ThemeToggle />
          <AccessibilitySettings />
          <NotificationToggle mobile={mobile} />
        </div>
      </SlideInPanel>

      <SlideInPanel
        open={privacyOpen}
        onOpenChange={handlePrivacyPanelChange}
        title="Privacy & Security"
      >
        <div className="flex flex-col flex-1 gap-3">
          <a
            href="https://merarashan.pk/privacy-policy.html"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-md border border-border/60 bg-card px-4 py-3 text-sm font-medium hover:bg-muted transition-colors"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </span>
            <span className="flex-1">Privacy Policy</span>
            <span aria-hidden className="text-muted-foreground">↗</span>
          </a>
          <a
            href="https://merarashan.pk/terms-of-service.html"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-md border border-border/60 bg-card px-4 py-3 text-sm font-medium hover:bg-muted transition-colors"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
              <ScrollText className="h-5 w-5 text-primary" />
            </span>
            <span className="flex-1">Terms of Service</span>
            <span aria-hidden className="text-muted-foreground">↗</span>
          </a>
          <div className="mt-auto space-y-3">
            <button
              type="button"
              onClick={() => {
                if (isCustomerActive) {
                  setFreezeConfirmOpen(true);
                } else {
                  setUnfreezeConfirmOpen(true);
                }
              }}
              disabled={freezing || unfreezing}
              className="flex w-full items-center gap-3 rounded-md border border-green-500/40 bg-card px-4 py-3 text-left text-sm font-medium text-green-600 dark:text-green-400 hover:bg-green-500/10 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-500/10">
                <Snowflake className={`h-5 w-5 text-green-600 dark:text-green-400 ${freezing || unfreezing ? "animate-spin" : ""}`} />
              </span>
              <span className="flex-1">
                {freezing ? "Freezing…" : unfreezing ? "Unfreezing…" : isCustomerActive ? "Freeze account" : "Unfreeze account"}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  isCustomerActive
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                }`}
              >
                {isCustomerActive ? "Active" : "Frozen"}
              </span>
              <span aria-hidden>›</span>
            </button>

            <button
              type="button"
              onClick={handleOpenDeleteAccount}
              className="flex w-full items-center gap-3 rounded-md border border-destructive/40 bg-card px-4 py-3 text-left text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <Trash2 className="h-5 w-5" />
              </span>
              <span className="flex-1">Delete account</span>
              <span aria-hidden>›</span>
            </button>
          </div>
        </div>
      </SlideInPanel>

      <AlertDialog open={unfreezeConfirmOpen} onOpenChange={(o) => !unfreezing && setUnfreezeConfirmOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm unfreeze account</AlertDialogTitle>
            <AlertDialogDescription>
              Your account is currently frozen. Unfreezing will reactivate your account and restore full access. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unfreezing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                setUnfreezeConfirmOpen(false);
                void handleUnfreezeAccount();
              }}
              disabled={unfreezing}
              className="bg-green-500 text-white hover:bg-green-600"
            >
              Unfreeze account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={freezeConfirmOpen} onOpenChange={(o) => !freezing && setFreezeConfirmOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader className="text-left sm:text-left">
            <AlertDialogTitle>Confirm freeze account</AlertDialogTitle>
            <AlertDialogDescription>
              Freezing your account is temporary and can be <em className="font-semibold">undone later</em>.
            </AlertDialogDescription>
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 flex gap-3 items-start text-sm">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-foreground space-y-1">
                <p>While your account is frozen:</p>
                <ul className="space-y-1">
                  <li className="flex items-start gap-2">
                    <X className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    <span>Your Mera Rashan Card will not work.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <X className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    <span>Ration Codes cannot be generated.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                    <span>You can still log in to view.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                    <span>Restore full access whenever you need.</span>
                  </li>
                </ul>
              </div>
            </div>
            <label className="flex items-start gap-2 text-sm text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-input text-primary focus:ring-primary accent-primary"
                checked={freezeConfirmed}
                onChange={(e) => setFreezeConfirmed(e.target.checked)}
              />
              <span>I understand and want to freeze my account.</span>
            </label>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={freezing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                setFreezeConfirmOpen(false);
                void handleFreezeAccount();
              }}
              disabled={freezing}
              className="bg-green-500 text-white hover:bg-green-600"
            >
              Freeze account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={frozenInfoOpen} onOpenChange={setFrozenInfoOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Account frozen</AlertDialogTitle>
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 flex gap-3 items-start text-sm">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-foreground space-y-1">
                <p>While your account is frozen:</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li><strong>Card Inactive:</strong> Your Mera Rashan Card will not work.</li>
                  <li><strong>No New Codes:</strong> Ration Codes cannot be generated.</li>
                  <li><strong>View Only:</strong> You can still log in to view your cards, rations, and statements.</li>
                  <li><strong>Unfreeze Anytime:</strong> Restore full access whenever you need to.</li>
                </ul>
              </div>
            </div>
            <p className="text-sm text-muted-foreground"><strong>Unfreezing will reactivate your account and restore full access. Are you sure?</strong></p>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                setFrozenInfoOpen(false);
                void handleUnfreezeAccount();
              }}
              disabled={unfreezing}
              className="bg-green-500 text-white hover:bg-green-600 inline-flex items-center gap-2"
            >
              <Unlock className="h-4 w-4" />
              Unfreeze account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SlideInPanel
        open={socialOpen}
        onOpenChange={handleSocialPanelChange}
        title="Social media"
      >
        <div className="space-y-3 pt-2">
          {[
            {
              label: "X",
              href: "https://x.com/merarashancard",
              icon: (
                <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5" fill="currentColor">
                  <path d="M18.244 2H21l-6.52 7.45L22 22h-6.797l-4.77-6.231L4.8 22H2.04l6.974-7.967L2 2h6.91l4.314 5.7L18.244 2Zm-1.193 18h1.84L7.04 4H5.07l11.98 16Z" />
                </svg>
              ),
            },
            {
              label: "Instagram",
              href: "https://www.instagram.com/mera.rashan.card",
              icon: <Instagram className="h-5 w-5 text-[#E4405F]" />,
            },
            {
              label: "Facebook",
              href: "https://www.facebook.com/MeraRashanCard",
              icon: <Facebook className="h-5 w-5 text-[#1877F2]" />,
            },
          ].map((item) => (
            <a
              key={item.label}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-md border border-border/60 bg-card px-4 py-3 text-sm font-medium hover:bg-muted transition-colors"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                {item.icon}
              </span>
              <span className="flex-1">{item.label}</span>
              <span aria-hidden className="text-muted-foreground">↗</span>
            </a>
          ))}
        </div>
      </SlideInPanel>

      <SlideInPanel
        open={deleteAccountOpen}
        onOpenChange={handleDeleteAccountPanelChange}
      >
        <div className="pt-2">
          <DeleteAccountSection
            mobile={mobile}
            expectedCustomerNumber={
              profileData?.payer_id != null ? String(profileData.payer_id) : ""
            }
            onDeleted={() => {
              localStorage.removeItem(STORAGE_KEY);
              setMobile(null);
            }}
          />
        </div>
      </SlideInPanel>
    </div>
  );
};

export default Index;
