import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { useEffect } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { toast } from "sonner";
import Index from "./pages/Index.tsx";
import CardDetails from "./pages/CardDetails.tsx";
import RashanDetails from "./pages/RashanDetails.tsx";
import DevTroubleshooting from "./pages/DevTroubleshooting.tsx";
import AdminNotify from "./pages/AdminNotify.tsx";
import NotFound from "./pages/NotFound.tsx";
import { initNativePushListeners, isNativePlatform } from "@/lib/nativePush";

const queryClient = new QueryClient();

function NativePushBridge() {
  useEffect(() => {
    if (!isNativePlatform()) return;
    initNativePushListeners({
      onForeground: (n) => {
        toast(n.title || "Notification", { description: n.body });
      },
      onAction: (url) => {
        if (url) window.location.assign(url);
      },
    }).catch(() => { /* ignore */ });
  }, []);
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <NativePushBridge />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/cards/:rcNum" element={<CardDetails />} />
          <Route path="/rashans/detail" element={<RashanDetails />} />
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
