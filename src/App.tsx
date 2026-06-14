import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import CardDetails from "./pages/CardDetails.tsx";
import RashanDetails from "./pages/RashanDetails.tsx";
import DevTroubleshooting from "./pages/DevTroubleshooting.tsx";
import AdminNotify from "./pages/AdminNotify.tsx";
import Notifications from "./pages/Notifications.tsx";
import NotFound from "./pages/NotFound.tsx";
import { initNativePushListeners, isNativePlatform } from "@/lib/nativePush";
import {
  PushNotificationDialog,
  type PushNotificationPayload,
} from "@/components/PushNotificationDialog";
import { InstallNativeAppBanner } from "@/components/InstallNativeAppBanner";
import { addNotification, syncNotificationInbox } from "@/lib/notificationsStore";
import { supabase } from "@/integrations/supabase/client";

const queryClient = new QueryClient();

function NativePushBridge() {
  const [pending, setPending] = useState<PushNotificationPayload | null>(null);

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
        addNotification(data.payload);
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
          addNotification({ title: n.title, body: n.body, url });
          setPending({ title: n.title, body: n.body, url });
        },
        onAction: (url, n) => {
          if (n) addNotification({ title: n.title, body: n.body, url });
          if (url) window.location.assign(url);
        },
        onDelivered: (n) => {
          const data = (n.data || {}) as Record<string, unknown>;
          const url = typeof data.url === "string" ? data.url : undefined;
          const dedupeKey = n.id || `${n.title}|${n.body}|${url || ""}`;
          addNotification({ title: n.title, body: n.body, url, dedupeKey });
        },
      }).catch(() => { /* ignore */ });
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
        <InstallNativeAppBanner />
        <NativePushBridge />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/cards/:rcNum" element={<CardDetails />} />
          <Route path="/rashans/detail" element={<RashanDetails />} />
          <Route path="/rashans/detail/:rcNum" element={<RashanDetails />} />
          <Route path="/dev/troubleshooting" element={<DevTroubleshooting />} />
          <Route path="/admin/notify" element={<AdminNotify />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/statements" element={<Index />} />
          <Route path="/cards" element={<Index />} />
          <Route path="/transactions" element={<Index />} />
          <Route path="/customers" element={<Index />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
