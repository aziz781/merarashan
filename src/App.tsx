import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useNavigate } from "react-router-dom";
import { Suspense, useEffect, useState } from "react";
import { lazyWithRetry as lazy } from "@/lib/lazyWithRetry";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { toast } from "sonner";

import { ensureNativeNotificationsOnStart, initNativePushListeners, isNativePlatform } from "@/lib/nativePush";
import {
  PushNotificationDialog,
  type PushNotificationPayload,
} from "@/components/PushNotificationDialog";
import { InstallNativeAppBanner } from "@/components/InstallNativeAppBanner";
import { OfflineBanner } from "@/components/OfflineBanner";
import { addNotification, syncNotificationInbox } from "@/lib/notificationsStore";
import { supabase } from "@/integrations/supabase/client";
import { openAppLink } from "@/lib/openAppLink";
import { queryClient } from "@/lib/queryClient";

// Lazy-load every route — including the authenticated shell — so the
// initial bundle for unauthenticated/first-time visitors stays minimal.
const Index = lazy(() => import("./pages/Index.tsx"));
const CardDetails = lazy(() => import("./pages/CardDetails.tsx"));
const RashanDetails = lazy(() => import("./pages/RashanDetails.tsx"));
const RashanDashboard = lazy(() => import("./pages/RashanDashboard.tsx"));
const DevTroubleshooting = lazy(() => import("./pages/DevTroubleshooting.tsx"));
const AdminNotify = lazy(() => import("./pages/AdminNotify.tsx"));
const Notifications = lazy(() => import("./pages/Notifications.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent.tsx"));
const AgentIntegrations = lazy(() => import("./pages/AgentIntegrations.tsx"));

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
    </div>
  );
}

function NativePushBridge() {
  const [pending, setPending] = useState<PushNotificationPayload | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void syncNotificationInbox();
    });
    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) void syncNotificationInbox();
    });

    // Listen for web push events broadcast from the service worker.
    const onSwMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; payload?: PushNotificationPayload } | undefined;
      if (data?.type === "push-received" && data.payload) {
        const p = data.payload;
        addNotification(p);
        const title = p.title || "Notification";
        toast(title, {
          description: p.body,
          duration: 6000,
          action: p.url
            ? { label: "Open", onClick: () => openAppLink(p.url, navigate) }
            : undefined,
        });
        setPending({ title: p.title, body: p.body, url: p.url });
      }
    };
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", onSwMessage);
    }

    if (isNativePlatform()) {
      initNativePushListeners({
        onForeground: (n) => {
          const data = (n.data || {}) as Record<string, unknown>;
          const url = typeof data.url === "string" ? data.url : undefined;
          const month = data.month != null ? String(data.month) : null;
          const year = data.year != null ? String(data.year) : null;
          addNotification({ title: n.title, body: n.body, url, month, year });
          // Foreground notifications are surfaced as a system heads-up banner
          // by nativePush.ts; the in-app toast is intentionally skipped so the
          // user isn't interrupted while already inside the app.
          // Also surface the richer modal for the latest message.
          setPending({ title: n.title, body: n.body, url });
        },
        onAction: (url, n) => {
          if (n) {
            const data = (n.data || {}) as Record<string, unknown>;
            const month = data.month != null ? String(data.month) : null;
            const year = data.year != null ? String(data.year) : null;
            addNotification({ title: n.title, body: n.body, url, month, year });
          }
          openAppLink(url, navigate);
        },
        onAppUrlOpen: (url) => {
          openAppLink(url, navigate);
        },
        onDelivered: (n) => {
          const data = (n.data || {}) as Record<string, unknown>;
          const url = typeof data.url === "string" ? data.url : undefined;
          const month = data.month != null ? String(data.month) : null;
          const year = data.year != null ? String(data.year) : null;
          const dedupeKey = n.id || `${n.title}|${n.body}|${url || ""}`;
          addNotification({ title: n.title, body: n.body, url, dedupeKey, month, year });
        },
      }).catch(() => { /* ignore */ });

      // On native start: check OS notification setting and prompt the user
      // if they have not yet responded. If permission is granted and we know
      // the user's mobile, silently register/refresh the FCM token.
      try {
        const mobile = localStorage.getItem("mr_mobile");
        void ensureNativeNotificationsOnStart(mobile);
      } catch { /* ignore */ }
    }

    const onFocus = () => void syncNotificationInbox();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void syncNotificationInbox();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", onSwMessage);
      }
      authSub.subscription.unsubscribe();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return <PushNotificationDialog notification={pending} onClose={() => setPending(null)} />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <OfflineBanner />
        <InstallNativeAppBanner />
        <NativePushBridge />
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/cards/:rcNum" element={<CardDetails />} />
            <Route path="/rashans/detail" element={<RashanDetails />} />
            <Route path="/rashans/detail/:rcNum" element={<RashanDetails />} />
            <Route path="/rashans/dashboard" element={<RashanDashboard />} />
            <Route path="/dev/troubleshooting" element={<DevTroubleshooting />} />
            <Route path="/admin/notify" element={<AdminNotify />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/statements" element={<Index />} />
            <Route path="/cards" element={<Index />} />
            <Route path="/transactions" element={<Index />} />
            <Route path="/customers" element={<Index />} />
            <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
