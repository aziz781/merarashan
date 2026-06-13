import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { useEffect, useState } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import CardDetails from "./pages/CardDetails.tsx";
import RashanDetails from "./pages/RashanDetails.tsx";
import DevTroubleshooting from "./pages/DevTroubleshooting.tsx";
import AdminNotify from "./pages/AdminNotify.tsx";
import NotFound from "./pages/NotFound.tsx";
import { initNativePushListeners, isNativePlatform } from "@/lib/nativePush";
import {
  PushNotificationDialog,
  type PushNotificationPayload,
} from "@/components/PushNotificationDialog";
import { InstallNativeAppBanner } from "@/components/InstallNativeAppBanner";

const queryClient = new QueryClient();

function NativePushBridge() {
  const [pending, setPending] = useState<PushNotificationPayload | null>(null);

  useEffect(() => {
    if (!isNativePlatform()) return;
    initNativePushListeners({
      onForeground: (n) => {
        const data = (n.data || {}) as Record<string, unknown>;
        const url = typeof data.url === "string" ? data.url : undefined;
        setPending({ title: n.title, body: n.body, url });
      },
      onAction: (url) => {
        if (url) window.location.assign(url);
      },
    }).catch(() => { /* ignore */ });
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
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
