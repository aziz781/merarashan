import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Receipt,
  CreditCard,
  Calendar,
  Tag,
  MessageSquare,
  TicketPercent,
  ShoppingBag,
  Check,
  Bell,
  Copy,
  Share2,
} from "lucide-react";
import html2canvas from "html2canvas";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { PageFooter } from "@/components/PageFooter";
import { fetchResource } from "@/lib/api";
import { subscribeNotifications, unreadCount } from "@/lib/notificationsStore";
import { PageHeader } from "@/components/PageHeader";

type Item = Record<string, unknown>;

const MOBILE_STORAGE_KEY = "mr_mobile";

function getRcNum(item?: Item) {
  return item?.rc_num == null ? "" : String(item.rc_num);
}

function itemMatchesRcNum(item: Item | undefined, rcNum: string) {
  return !rcNum || getRcNum(item) === rcNum;
}

function extractItems(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  const d = data as { items?: unknown[]; data?: unknown[] };
  if (Array.isArray(d?.items)) return d.items;
  if (Array.isArray(d?.data)) return d.data;
  return data && typeof data === "object" ? [data] : [];
}

const CATEGORIES: {
  id: string;
  title: string;
  icon: typeof Receipt;
  match: (key: string) => boolean;
}[] = [
  {
    id: "status",
    title: "RASHAN",
    icon: Tag,
    match: (k) =>
      k === "datetime_display" ||
      (/(status|state|delivered|pending)/i.test(k) && !/(payment_status|code_status)/i.test(k)),
  },
  {
    id: "card",
    title: "Card",
    icon: CreditCard,
    match: (k) =>
      /(rc_num|card|cm_|amount|price|gross|net|fee|discount|paid|balance)/i.test(k) && !/(charge|total)/i.test(k),
  },
  {
    id: "dates",
    title: "UPDATES",
    icon: Calendar,
    match: (k) =>
      /(date|time|period|created|updated|delivered_at)/i.test(k) && k !== "month_year" && k !== "payment_datetime",
  },
];

function isMoneyKey(k: string) {
  return /(amount|charge|price|total|gross|net|fee|discount|paid|balance)/i.test(k);
}

function formatValue(key: string, raw: unknown): React.ReactNode {
  if (raw == null || raw === "") return "—";
  if (typeof raw === "boolean") {
    return (
      <Badge variant={raw ? "default" : "outline"} className="font-normal">
        {raw ? "Yes" : "No"}
      </Badge>
    );
  }
  if (/status$/i.test(key)) {
    const s = String(raw);
    const lower = s.toLowerCase();
    const variant =
      lower === "delivered" || lower === "paid"
        ? "default"
        : lower === "not_paid" || lower === "cancelled" || lower === "not_delivered"
          ? "destructive"
          : "outline";
    return (
      <Badge variant={variant} className="font-normal">
        {s}
      </Badge>
    );
  }
  if (isMoneyKey(key)) {
    const n = Number(raw);
    if (Number.isFinite(n) && String(raw).trim() !== "") {
      return `Rs. ${n.toLocaleString("en-PK")}`;
    }
  }
  return String(raw);
}

function humanizeKey(k: string) {
  if (k === "things_status") return "Status";
  return k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

type TimelineStep = {
  label: string;
  dateKey: string;
  timeKey: string;
  statusKey?: string;
  fallbackStatus?: string;
  detailKey?: string;
  detailPrefix?: string;
  detailCodeKey?: string;
  detailConnector?: string;
  detailSuffixKey?: string;
  detailSuffixLabel?: string;
};

const TIMELINE_STEPS: TimelineStep[] = [
  {
    label: "Rashan Code",
    dateKey: "created_date",
    timeKey: "created_time",
    detailKey: "userMobileNumber",
    detailPrefix: "Rashan Code",
    detailCodeKey: "unique_code",
    detailConnector: "sent in SMS at",
  },
  {
    label: "Redeemed",
    dateKey: "accept_datetime",
    timeKey: "",
    statusKey: "code_status",
    detailKey: "registered_business_number",
    detailPrefix: "Redeemed at Karyana Store",
  },
  {
    label: "Collected",
    dateKey: "confirm_datetime",
    timeKey: "",
    statusKey: "things_status",
    detailKey: "registered_business_number",
    detailPrefix: "Collected at Karyana Store",
  },
  {
    label: "Payment",
    dateKey: "payment_datetime",
    timeKey: "",
    statusKey: "payment_status",
    detailKey: "payment_method",
    detailPrefix: "Paid, Karyana Store ({registered_business_number}) in",
    detailSuffixKey: "payment_account",
    detailSuffixLabel: "account",
  },
  {
    label: "Completed",
    dateKey: "",
    timeKey: "",
    statusKey: "payment_status",
  },
];

function UpdatesTimeline({ item }: { item: Item }) {
  const get = (k: string) => {
    const v = item[k];
    return v == null || v === "" ? "" : String(v);
  };

  return (
    <ol className="relative">
      {TIMELINE_STEPS.filter((s) => {
        const status = get(s.statusKey!);
        if (s.label === "Completed") return status.toUpperCase() === "PAID";
        return true;
      }).map((step, idx, arr) => {
        const date = get(step.dateKey);
        const time = get(step.timeKey);
        const detail = step.detailKey ? get(step.detailKey) : "";
        const statusVal = step.statusKey ? get(step.statusKey) : step.fallbackStatus || "";
        const done =
          step.statusKey === "code_status"
            ? statusVal.toUpperCase() === "USED"
            : step.statusKey === "things_status"
              ? statusVal.toLowerCase() === "delivered"
              : step.statusKey === "payment_status"
                ? statusVal.toUpperCase() === "PAID"
                : Boolean(date || time || statusVal);
        const isLast = idx === arr.length - 1;
        const lower = statusVal.toLowerCase();
        const variant: "default" | "destructive" | "outline" =
          lower === "delivered" ||
          lower === "paid" ||
          lower === "completed" ||
          lower === "accepted" ||
          lower === "confirmed"
            ? "default"
            : lower === "not_paid" || lower === "not_delivered" || lower === "cancelled" || lower === "rejected"
              ? "destructive"
              : "outline";

        return (
          <li key={step.label} className="relative pl-7 pb-5 last:pb-0">
            {!isLast && (
              <span
                aria-hidden
                className={`absolute left-[9px] top-4 bottom-0 w-px ${done ? "bg-primary/40" : "bg-border"}`}
              />
            )}
            <span
              aria-hidden
              className={`absolute left-0 top-1 flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 ${
                step.label === "Completed" && done
                  ? "border-emerald-700 bg-emerald-700"
                  : done
                    ? "border-primary bg-primary"
                    : "border-border bg-background"
              }`}
            >
              {step.label === "Completed" && done ? (
                <Check className="h-3 w-3 text-white" />
              ) : done ? (
                <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
              ) : null}
            </span>
            <div className="flex items-start justify-between gap-3">
              <p className={`text-sm font-medium ${done ? "text-foreground" : "text-muted-foreground"}`}>
                {step.label}
              </p>
            </div>
            {(date || time) &&
              ((step.statusKey !== "things_status" &&
                step.statusKey !== "code_status" &&
                step.statusKey !== "payment_status") ||
                (step.statusKey === "payment_status"
                  ? statusVal.toUpperCase() === "PAID"
                  : get("things_status").toLowerCase() === "delivered")) && (
                <p className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                  {date && <span>📅 {date}</span>}
                  {time && <span>🕒 {time}</span>}
                </p>
              )}
            {detail &&
              step.detailPrefix &&
              (step.statusKey === "things_status" ? statusVal.toLowerCase() === "delivered" : date || time) && (
                <p className="mt-1 text-xs text-muted-foreground flex items-start gap-1.5">
                  {step.detailConnector?.toLowerCase().includes("sms") && (
                    <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
                  )}
                  {step.statusKey === "code_status" && (
                    <TicketPercent className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
                  )}
                  {step.statusKey === "things_status" && (
                    <ShoppingBag className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
                  )}
                  {step.statusKey === "payment_status" && (
                    <Receipt className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
                  )}
                  <span>
                    {step.detailPrefix.replace(/\{(\w+)\}/g, (_, key) => get(key))}{" "}
                    {step.detailCodeKey && `(${get(step.detailCodeKey)})`}{" "}
                    {step.detailConnector && `${step.detailConnector} `}
                    {detail}
                    {step.detailSuffixKey &&
                      step.detailSuffixLabel &&
                      ` ${step.detailSuffixLabel} (${get(step.detailSuffixKey)})`}
                  </span>
                </p>
              )}
          </li>
        );
      })}
    </ol>
  );
}

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
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }, []);
  const isTriggered = useCallback(() => {
    const t = triggeredRef.current;
    triggeredRef.current = false;
    return t;
  }, []);
  return { start, cancel, isTriggered };
}

function CardDetailsPopup({
  card,
  open,
  onOpenChange,
}: {
  card: Record<string, unknown> | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const allowedKeys: { key: string; label: string }[] = [
    { key: "cm_card_number", label: "Card Number" },
    { key: "person_name", label: "Name" },
    { key: "amount", label: "Amount" },
    { key: "mobile_number", label: "Mobile" },
    { key: "city", label: "City" },
    { key: "reg_date", label: "Registration Date" },
  ];
  const entries = card
    ? allowedKeys
        .map(({ key }) => [key, card[key]] as const)
        .filter(([, v]) => v !== null && v !== "" && v !== undefined)
    : [];
  const labelMap = Object.fromEntries(allowedKeys.map(({ key, label }) => [key, label]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2 pr-6">
            <span className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Card Details
            </span>
            <button
              type="button"
              aria-label="Copy all details"
              title="Copy all"
              onClick={async () => {
                const text = entries.map(([k, v]) => `${labelMap[k] || k}: ${v ?? ""}`).join("\n");
                try {
                  if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
                  else {
                    const ta = document.createElement("textarea");
                    ta.value = text; document.body.appendChild(ta); ta.select();
                    document.execCommand("copy"); document.body.removeChild(ta);
                  }
                  toast({ title: "Copied all details" });
                } catch {
                  toast({ title: "Copy failed", variant: "destructive" });
                }
              }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <Copy className="w-4 h-4" />
              Copy all
            </button>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No card details available.</p>
          ) : (
            entries.map(([key, value], i) => {
              const hideLabel = key === "cm_card_number";
              return (
                <div key={key}>
                  <div className="flex justify-between gap-3 text-sm items-start">
                    {!hideLabel && (
                      <span className="text-muted-foreground shrink-0">{labelMap[key] || key}</span>
                    )}
                    <span className={`font-medium text-foreground text-right break-all ${hideLabel ? "w-full" : ""}`}>{String(value)}</span>
                  </div>
                  {i < entries.length - 1 && <Separator className="mt-3" />}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const RashanDetails = () => {
  const navigate = useNavigate();
  const params = useParams<{ rcNum?: string }>();
  const rcNumParam = params.rcNum ? decodeURIComponent(params.rcNum) : "";
  const location = useLocation() as { state?: { item?: Item; origin?: "home" | "rashans" } };
  const stateItem = itemMatchesRcNum(location.state?.item, rcNumParam) ? location.state?.item : undefined;
  const [fetchedItem, setFetchedItem] = useState<Item | undefined>();
  const [loadingDetail, setLoadingDetail] = useState(Boolean(rcNumParam && !stateItem));
  const [detailError, setDetailError] = useState<string | null>(null);
  const [notifUnread, setNotifUnread] = useState(0);
  const [cardPopupOpen, setCardPopupOpen] = useState(false);
  const [cardData, setCardData] = useState<Record<string, unknown> | null>(null);
  const [sharing, setSharing] = useState(false);
  const shareRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setNotifUnread(unreadCount());
    return subscribeNotifications(() => setNotifUnread(unreadCount()));
  }, []);
  let item = stateItem;
  let origin = location.state?.origin ?? "home";
  if (!item && rcNumParam) {
    try {
      const raw = sessionStorage.getItem(`rashanDetailItem:${rcNumParam}`);
      if (raw) {
        const parsed = JSON.parse(raw) as { item?: Item; origin?: "home" | "rashans" };
        if (itemMatchesRcNum(parsed.item, rcNumParam)) {
          item = parsed.item;
          origin = parsed.origin ?? origin;
        }
      }
    } catch (_) { /* ignore */ }
  }
  if (!item && !rcNumParam) {
    try {
      const raw = sessionStorage.getItem("rashanDetailItem");
      if (raw) {
        const parsed = JSON.parse(raw) as { item?: Item; origin?: "home" | "rashans" };
        item = parsed.item;
        origin = parsed.origin ?? origin;
      }
    } catch (_) { /* ignore */ }
  }
  if (!item && itemMatchesRcNum(fetchedItem, rcNumParam)) item = fetchedItem;

  useEffect(() => {
    if (!rcNumParam || item) {
      setLoadingDetail(false);
      return;
    }
    let cancelled = false;
    setLoadingDetail(true);
    setDetailError(null);
    try {
      const mobile = localStorage.getItem(MOBILE_STORAGE_KEY);
      if (!mobile) {
        setLoadingDetail(false);
        return;
      }
      fetchResource("transactions", mobile, { rcNum: rcNumParam })
        .then((data) => {
          if (cancelled) return;
          const match = extractItems(data).find((entry) => itemMatchesRcNum(entry as Item, rcNumParam)) as Item | undefined;
          if (match) {
            setFetchedItem(match);
            try {
              sessionStorage.setItem(`rashanDetailItem:${rcNumParam}`, JSON.stringify({ item: match, origin: "rashans" }));
            } catch (_) { /* ignore */ }
          }
        })
        .catch((e) => !cancelled && setDetailError(e instanceof Error ? e.message : "Failed to load rashan"))
        .finally(() => !cancelled && setLoadingDetail(false));
    } catch (_) {
      setLoadingDetail(false);
    }
    return () => {
      cancelled = true;
    };
  }, [rcNumParam, item]);

  const goBack = () => {
    try {
      sessionStorage.setItem("activeTab", origin === "rashans" ? "transactions" : "customers");
    } catch (_) {
      /* ignore */
    }
    navigate("/");
  };

  const cardRcNumTop = item ? getRcNum(item) : "";
  const openCardPopup = useCallback(async () => {
    if (!item) return;
    if (cardData) { setCardPopupOpen(true); return; }
    const fallback: Record<string, unknown> = {
      cm_card_number: item?.cm_card_number ?? item?.rc_num,
      mobile_number: item?.mobile_number ?? item?.userMobileNumber,
      city: item?.city,
      reg_date: item?.reg_date,
    };
    setCardData(fallback);
    setCardPopupOpen(true);
    try {
      const mobile = localStorage.getItem(MOBILE_STORAGE_KEY);
      if (!mobile) return;
      const d = await fetchResource<unknown>("cards", mobile);
      const list = extractItems(d) as Record<string, unknown>[];
      const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "");
      const target = digits(cardRcNumTop);
      const found = list.find((c) => digits(c.cm_card_number) === target);
      if (found) setCardData(found);
    } catch { /* ignore */ }
  }, [cardData, cardRcNumTop, item]);
  const cardLongPress = useLongPress(openCardPopup, 500);

  const handleShare = useCallback(async () => {
    const node = shareRef.current;
    if (!node || sharing) return;
    setSharing(true);

    // Detect native up-front so we can tune capture cost and preload plugins
    // in parallel with html2canvas (saves ~hundreds of ms on Android).
    const capMod = await import("@capacitor/core").catch(() => null);
    const isNative = !!capMod?.Capacitor?.isNativePlatform?.();
    const nativePluginsPromise = isNative
      ? Promise.all([
          import("@capacitor/filesystem"),
          import("@capacitor/share"),
        ])
      : null;

    // Immediate feedback — html2canvas blocks the main thread.
    toast({ title: "Preparing image…" });

    try {
      const bgEl = document.querySelector(".bg-background") as HTMLElement | null;
      const bg = bgEl ? getComputedStyle(bgEl).backgroundColor : "#ffffff";
      const rect = node.getBoundingClientRect();
      const width = Math.ceil(rect.width);
      const height = Math.ceil(Math.max(node.scrollHeight, rect.height));
      // Cap scale lower on native — Android WebView is slow at PNG/JPEG
      // encoding of large canvases and the share preview is small anyway.
      const scale = isNative ? 1.5 : Math.min(window.devicePixelRatio || 2, 2);
      const canvas = await html2canvas(node, {
        backgroundColor: bg || "#ffffff",
        scale,
        useCORS: true,
        width,
        height,
        windowWidth: width,
        windowHeight: height,
        scrollX: 0,
        scrollY: -window.scrollY,
        logging: false,
        imageTimeout: 0,
      });

      const fileName = `rashan-${getRcNum(item) || "details"}.jpg`;
      const shareText = `Rashan Details${item?.month_year ? ` — ${item.month_year}` : ""}`;

      // Native (Capacitor) path: skip Blob+FileReader and go straight to
      // a base64 JPEG data URL — JPEG encodes ~3–5x faster than PNG and
      // we avoid an extra copy round-trip.
      if (isNative && nativePluginsPromise) {
        try {
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          const base64 = dataUrl.split(",")[1] || "";
          const [{ Filesystem, Directory }, { Share }] = await nativePluginsPromise;
          const written = await Filesystem.writeFile({
            path: fileName,
            data: base64,
            directory: Directory.Cache,
          });
          await Share.share({
            title: shareText,
            text: shareText,
            url: written.uri,
            dialogTitle: "Share Rashan",
          });
          return;
        } catch (err) {
          if ((err as { message?: string })?.message?.toLowerCase().includes("cancel")) return;
          // fall through to web flow
        }
      }

      // Web path keeps PNG quality for desktop downloads.
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/png", 0.95),
      );
      if (!blob) throw new Error("Could not create image");
      const webFileName = `rashan-${getRcNum(item) || "details"}.png`;
      const file = new File([blob], webFileName, { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare && nav.canShare({ files: [file] }) && navigator.share) {
        try {
          await navigator.share({ files: [file], title: shareText, text: shareText });
          return;
        } catch (err) {
          if ((err as DOMException)?.name === "AbortError") return;
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = webFileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast({
        title: "Image downloaded",
        description: "WhatsApp Web can't auto-attach images. Open WhatsApp and attach the saved image.",
      });
    } catch (e) {
      toast({
        title: "Share failed",
        description: e instanceof Error ? e.message : "Could not create share image",
        variant: "destructive",
      });
    } finally {
      setSharing(false);
    }
  }, [item, sharing]);


  if (!item) {
    return (
      <div className="min-h-screen px-5 pt-10">
        <Button variant="ghost" size="sm" onClick={goBack} className="-ml-2 mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">
            {loadingDetail
              ? "Loading rashan details..."
              : detailError
                ? "Unable to load this rashan. Please open it from the rashans list."
                : "No rashan data. Open this page from the rashans list."}
          </p>
        </Card>
      </div>
    );
  }

  const entries = Object.entries(item).filter(([, v]) => v !== undefined && typeof v !== "object");

  const used = new Set<string>();
  const grouped = CATEGORIES.map((c) => {
    const rows = entries.filter(([k]) => {
      if (used.has(k)) return false;
      if (!c.match(k)) return false;
      used.add(k);
      return true;
    });
    if (c.id === "card") {
      rows.sort((a, b) => {
        if (a[0] === "rc_num") return -1;
        if (b[0] === "rc_num") return 1;
        return a[0].localeCompare(b[0]);
      });
    }
    if (c.id === "dates") {
      rows.sort((a, b) => {
        if (a[0] === "created_date") return -1;
        if (b[0] === "created_date") return 1;
        return 0;
      });
    }
    return { ...c, rows };
  }).filter((g) => g.rows.length > 0);

  const title =
    (item.code_user_name as string) || (item.person_name as string) || (item.month_year as string) || "Rashan Details";

  const subtitle = (item.month_year as string) || "";


  return (
    <div className="min-h-screen pb-16">
      <div ref={shareRef} className="bg-background">
      <PageHeader>
        <div className="flex items-center justify-end gap-2 mb-3" data-share-hide>
          <button
            type="button"
            onClick={() => navigate("/notifications")}
            aria-label="Notifications"
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm text-primary-foreground ring-1 ring-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 hover:bg-white/25 transition-colors dark:bg-primary/25 dark:text-primary dark:ring-primary/50 dark:hover:bg-primary/35"
          >
            <Bell className="h-5 w-5" />
            {notifUnread > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-[18px] text-center ring-2 ring-[hsl(var(--primary))]">
                {notifUnread > 99 ? "99+" : notifUnread}
              </span>
            )}
          </button>
        </div>
        <div className="flex items-center gap-3">
          <Receipt className="w-6 h-6 opacity-90" />
          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate">{title}</h1>
            {subtitle && <p className="text-xs opacity-80 truncate">{subtitle}</p>}
          </div>
        </div>
      </PageHeader>


      <main className="px-5 -mt-3 space-y-4">
        {grouped.map(({ id, title, icon: Icon, rows }) => {
          const cardRcNum = getRcNum(item);
          const isCardTile = id === "card" && cardRcNum;
          const lpHandlers = isCardTile ? {
            onPointerDown: () => cardLongPress.start(),
            onPointerUp: () => cardLongPress.cancel(),
            onPointerLeave: () => cardLongPress.cancel(),
            onPointerCancel: () => cardLongPress.cancel(),
            onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); },
          } : {};
          return (
          <Card
            key={id}
            role={isCardTile ? "button" : undefined}
            tabIndex={isCardTile ? 0 : undefined}
            onClick={isCardTile ? () => {
              if (cardLongPress.isTriggered()) return;
              navigate(`/cards/${encodeURIComponent(cardRcNum)}`);
            } : undefined}
            onKeyDown={isCardTile ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                navigate(`/cards/${encodeURIComponent(cardRcNum)}`);
              }
            } : undefined}
            {...lpHandlers}
            style={isCardTile ? { WebkitUserSelect: "none", userSelect: "none", WebkitTouchCallout: "none" } : undefined}
            className={`p-4 bg-card/90 backdrop-blur shadow-[var(--shadow-soft)] border-border/50 ${isCardTile ? "cursor-pointer transition-transform hover:scale-[1.01] active:scale-[0.99]" : ""}`}
          >
            <div className="flex items-center gap-2 mb-3">
              <Icon className="w-4 h-4 text-primary" />
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold">{title}</p>
            </div>
            {id === "dates" ? (
              <UpdatesTimeline item={item} />
            ) : (
              <div className="space-y-1.5">
                {rows.map(([k, v]) => (
                  <div
                    key={k}
                    className="flex justify-between gap-3 text-sm items-center border-b border-border/40 py-1.5 last:border-0"
                  >
                    {k === "rc_num" || k.toLowerCase() === "amount" ? null : k ===
                      "datetime_display" ? null : humanizeKey(k).toLowerCase() === "status" ? null : (
                      <span className="text-muted-foreground">{humanizeKey(k)}</span>
                    )}
                    {(() => {
                      const cd = item.confirm_datetime;
                      const empty = cd == null || String(cd).trim() === "" || String(cd).trim().toUpperCase() === "N/A";
                      const isExpired = String(item.code_status ?? "").toUpperCase() === "EXPIRED";
                      const showExpired = k === "datetime_display" && isExpired;
                      const showPlaceholder = k === "datetime_display" && empty && !isExpired;
                      const colorCls = showExpired
                        ? "text-destructive font-normal italic"
                        : k === "datetime_display"
                          ? "text-muted-foreground font-normal italic"
                          : k === "rc_num"
                            ? "text-muted-foreground font-bold italic"
                            : isMoneyKey(k)
                              ? "text-muted-foreground font-normal italic"
                              : "text-foreground";
                      return (
                        <span className={`font-medium text-right break-all ml-auto ${colorCls}`}>
                          {showExpired
                            ? `Rashan code is expired as not used by ${item.valid_to || "—"}.`
                            : showPlaceholder
                              ? `Rashan code has not been used yet. Use by ${item.valid_to || "—"}`
                              : formatValue(k, v)}
                        </span>
                      );
                    })()}
                  </div>
                ))}
              </div>
            )}
          </Card>
        );})}
      </main>
      </div>
      <CardDetailsPopup card={cardData} open={cardPopupOpen} onOpenChange={setCardPopupOpen} />
      <button
        type="button"
        onClick={goBack}
        aria-label="Back"
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-1 ring-primary/30 hover:bg-primary/90 transition-colors animate-in fade-in slide-in-from-bottom-2"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={handleShare}
        disabled={sharing}
        aria-label="Share as image on WhatsApp"
        className="fixed bottom-6 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-1 ring-primary/30 hover:bg-primary/90 transition-colors animate-in fade-in slide-in-from-bottom-2 disabled:opacity-60"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <Share2 className="h-5 w-5" />
      </button>
      <PageFooter />
    </div>
  );
};

export default RashanDetails;
