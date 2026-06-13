import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CreditCard, Bell, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchResource } from "@/lib/api";
import { TransactionCard } from "@/components/TransactionCard";
import { PageFooter } from "@/components/PageFooter";
import { subscribeNotifications, unreadCount } from "@/lib/notificationsStore";

const STORAGE_KEY = "mr_mobile";

function extractItems(data: unknown): unknown[] | null {
  if (Array.isArray(data)) return data;
  const d = data as { items?: unknown[]; data?: unknown[] };
  if (Array.isArray(d?.items)) return d.items;
  if (Array.isArray(d?.data)) return d.data;
  return null;
}

const CardDetails = () => {
  const navigate = useNavigate();
  const location = useLocation() as { state?: { card?: Record<string, unknown> } };
  const { rcNum: rcNumParam } = useParams();
  const rcNum = rcNumParam || "";
  const [card, setCard] = useState<Record<string, unknown> | undefined>(location.state?.card);
  const [cardLoading, setCardLoading] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const mobile = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;

  // Sync card when route or router-state changes (e.g., swipe to sibling card)
  useEffect(() => {
    const d = (v: unknown) => String(v ?? "").replace(/\D/g, "");
    const stateCard = location.state?.card;
    if (stateCard && d(stateCard.cm_card_number) === d(rcNum)) {
      setCard(stateCard);
    } else if (card && d(card.cm_card_number) !== d(rcNum)) {
      setCard(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rcNum, location.state]);

  const [txns, setTxns] = useState<Record<string, unknown>[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notifUnread, setNotifUnread] = useState(0);
  const [allCards, setAllCards] = useState<Record<string, unknown>[]>([]);
  const [swipeDx, setSwipeDx] = useState(0);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    setNotifUnread(unreadCount());
    return subscribeNotifications(() => setNotifUnread(unreadCount()));
  }, []);

  // Always fetch cards list for swipe navigation (and as fallback when opened via direct link)
  useEffect(() => {
    if (!mobile) return;
    let cancelled = false;
    setCardLoading(!card);
    setCardError(null);
    fetchResource<unknown>("cards", mobile)
      .then((d) => {
        if (cancelled) return;
        const items = (extractItems(d) ?? []) as Record<string, unknown>[];
        setAllCards(items);
        if (!card && rcNum) {
          const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "");
          const target = digits(rcNum);
          const found = items.find((c) => digits(c.cm_card_number) === target);
          if (found) setCard(found);
          else setCardError("Card not found for this account.");
        }
      })
      .catch((e) => !cancelled && setCardError(e.message))
      .finally(() => !cancelled && setCardLoading(false));
    return () => { cancelled = true; };
  }, [mobile, rcNum, card]);

  useEffect(() => {
    if (!mobile || !rcNum) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const digits = rcNum.replace(/\D/g, "");
    const formattedRc = digits.replace(/(.{4})(?=.)/g, "$1 ");
    fetchResource<unknown>("transactions", mobile, { rcNum: formattedRc })
      .then((d) => {
        if (cancelled) return;
        setTxns((extractItems(d) ?? []) as Record<string, unknown>[]);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [mobile, rcNum]);

  const fields: { key: string; label: string }[] = [
    { key: "person_name", label: "Name" },
    { key: "cm_card_number", label: "Card Number" },
    { key: "mobile_number", label: "Mobile" },
    { key: "city", label: "City" },
    { key: "reg_date", label: "Registration Date" },
  ];

  const title =
    (card?.person_name as string) ||
    (card?.card_name as string) ||
    (card?.cm_card_number as string) ||
    "Card Details";

  const digitsOnly = (v: unknown) => String(v ?? "").replace(/\D/g, "");
  const currentIndex = allCards.findIndex(
    (c) => digitsOnly(c.cm_card_number) === digitsOnly(rcNum),
  );
  const prevCard = currentIndex > 0 ? allCards[currentIndex - 1] : null;
  const nextCard =
    currentIndex >= 0 && currentIndex < allCards.length - 1
      ? allCards[currentIndex + 1]
      : null;

  const goToCard = (target: Record<string, unknown>) => {
    const num = String(target.cm_card_number ?? "");
    navigate(`/cards/${encodeURIComponent(num)}`, { state: { card: target } });
  };

  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const locked = useRef<"h" | "v" | null>(null);
  const dxRef = useRef(0);
  const SWIPE_THRESHOLD = 70;
  const SWIPE_MAX = typeof window !== "undefined" ? Math.round(window.innerWidth * 0.75) : 280;

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (allCards.length <= 1) return;
    startX.current = e.clientX;
    startY.current = e.clientY;
    locked.current = null;
    setAnimating(false);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (startX.current === null || startY.current === null) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    if (locked.current === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      locked.current = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
    }
    if (locked.current !== "h") return;
    let clamped = Math.max(-SWIPE_MAX, Math.min(SWIPE_MAX, dx));
    // Resist when no neighbor in that direction
    if (clamped < 0 && !nextCard) clamped = clamped / 4;
    if (clamped > 0 && !prevCard) clamped = clamped / 4;
    dxRef.current = clamped;
    setSwipeDx(clamped);
  };
  const onPointerUp = () => {
    const d = dxRef.current;
    startX.current = null;
    startY.current = null;
    locked.current = null;
    setAnimating(true);
    if (d <= -SWIPE_THRESHOLD && nextCard) {
      setSwipeDx(0);
      dxRef.current = 0;
      goToCard(nextCard);
    } else if (d >= SWIPE_THRESHOLD && prevCard) {
      setSwipeDx(0);
      dxRef.current = 0;
      goToCard(prevCard);
    } else {
      setSwipeDx(0);
      dxRef.current = 0;
    }
  };

  return (
    <div className="min-h-screen pb-16">
      <header
        className="px-5 pt-10 pb-6 text-primary-foreground"
        style={{ background: "var(--gradient-primary)" }}
      >
        <div className="flex items-center justify-between mb-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="text-primary-foreground hover:bg-white/10 -ml-2"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <button
            type="button"
            onClick={() => navigate("/notifications")}
            aria-label="Notifications"
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm text-primary-foreground ring-1 ring-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 hover:bg-white/25 transition-colors"
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
          <CreditCard className="w-6 h-6 opacity-90" />
          <h1 className="text-xl font-bold truncate">میرا راشن کارڈ</h1>
        </div>
      </header>


      <main
        className="px-5 -mt-3 space-y-5 select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ touchAction: "pan-y" }}
      >
      {allCards.length > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground -mb-2">
          <button
            type="button"
            onClick={() => prevCard && goToCard(prevCard)}
            disabled={!prevCard}
            className="inline-flex items-center gap-1 disabled:opacity-30"
            aria-label="Previous card"
          >
            <ChevronLeft className="w-4 h-4" />
            Prev
          </button>
          <span>
            {currentIndex + 1} / {allCards.length}
          </span>
          <button
            type="button"
            onClick={() => nextCard && goToCard(nextCard)}
            disabled={!nextCard}
            className="inline-flex items-center gap-1 disabled:opacity-30"
            aria-label="Next card"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
      {(() => {
        const renderCardBody = (c: Record<string, unknown>) => (
          <Card className="p-5 bg-card/95 backdrop-blur shadow-[var(--shadow-card)] border-0">
            <div className="space-y-1.5">
              {fields.map(({ key, label }) => {
                const isName = key === "person_name";
                const raw = c[key];
                const display = raw == null || raw === "" ? "—" : String(raw);
                return (
                  <div
                    key={key}
                    className={`flex justify-between gap-3 border-b border-border/50 py-1.5 last:border-0 ${isName ? "" : "text-sm"}`}
                  >
                    {!isName && (
                      <span className="text-muted-foreground">{label}</span>
                    )}
                    <span
                      className={`break-all ${isName ? "font-bold text-foreground w-full text-right text-xl" : "text-muted-foreground text-right"}`}
                    >
                      {display}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        );
        const transition = animating ? "transform 220ms ease-out" : "none";
        return (
          <div className="relative overflow-hidden">
            <div
              className="relative"
              style={{
                transform: `translateX(${swipeDx}px) rotate(${swipeDx * 0.02}deg)`,
                transition,
              }}
            >
              {card ? (
                renderCardBody(card)
              ) : cardLoading ? (
                <Card className="p-5">
                  <Skeleton className="h-6 w-2/3 mb-2" />
                  <Skeleton className="h-4 w-full" />
                </Card>
              ) : (
                <Card className="p-5">
                  <p className="text-sm text-muted-foreground">
                    {cardError || (!mobile ? "Please sign in to view this card." : "No card data.")}
                  </p>
                </Card>
              )}
            </div>
            {prevCard && (
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  transform: `translateX(calc(-100% - 24px + ${swipeDx}px))`,
                  transition,
                }}
              >
                {renderCardBody(prevCard)}
              </div>
            )}
            {nextCard && (
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  transform: `translateX(calc(100% + 24px + ${swipeDx}px))`,
                  transition,
                }}
              >
                {renderCardBody(nextCard)}
              </div>
            )}
          </div>
        );
      })()}



      <section>
        <h2 className="text-sm font-semibold text-foreground mb-3">Monthly Rashan</h2>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-2xl" />
              ))}
            </div>
          ) : error ? (
            <Card className="p-5 border-destructive/30 bg-destructive/5">
              <p className="text-sm font-medium text-destructive mb-1">Failed to load</p>
              <p className="text-xs text-muted-foreground break-all">{error}</p>
            </Card>
          ) : !txns || txns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions found.</p>
          ) : (
            <div className="space-y-3">
              {txns.map((t, i) => (
                <TransactionCard key={i} item={t} variant="compact" />
              ))}
            </div>
          )}
        </section>
      </main>
      <PageFooter />
    </div>
  );
};

export default CardDetails;
