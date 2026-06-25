import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CreditCard, Bell } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingState } from "@/components/LoadingState";
import { useResource } from "@/lib/api";
import { TransactionCard } from "@/components/TransactionCard";
import { PageFooter } from "@/components/PageFooter";
import { subscribeNotifications, unreadCount } from "@/lib/notificationsStore";
import { extractItems, digitsOnly, getItemKey } from "@/lib/itemUtils";
import type { Card as CardModel, Transaction } from "@/types/domain";

const STORAGE_KEY = "mr_mobile";

const CardDetails = () => {
  const navigate = useNavigate();
  const location = useLocation() as { state?: { card?: Record<string, unknown> } };
  const { rcNum: rcNumParam } = useParams();
  const rcNum = rcNumParam || "";
  const [card, setCard] = useState<CardModel | undefined>(location.state?.card as CardModel | undefined);
  const mobile = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;

  // Sync card when route or router-state changes (e.g., swipe to sibling card)
  useEffect(() => {
    const stateCard = location.state?.card as CardModel | undefined;
    if (stateCard && digitsOnly(stateCard.cm_card_number) === digitsOnly(rcNum)) {
      setCard(stateCard);
    } else if (card && digitsOnly(card.cm_card_number) !== digitsOnly(rcNum)) {
      setCard(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rcNum, location.state]);

  const [notifUnread, setNotifUnread] = useState(0);
  const [swipeDx, setSwipeDx] = useState(0);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    setNotifUnread(unreadCount());
    return subscribeNotifications(() => setNotifUnread(unreadCount()));
  }, []);

  // Always fetch cards list for swipe navigation (and as fallback when opened via direct link)
  const {
    data: cardsRaw,
    isPending: cardsPending,
    fetchStatus: cardsFetchStatus,
    error: cardsQueryError,
  } = useResource<unknown>("cards", mobile ?? undefined);
  const allCards = useMemo<CardModel[]>(
    () => (extractItems(cardsRaw) ?? []) as CardModel[],
    [cardsRaw],
  );
  const cardLoading = !card && cardsPending && cardsFetchStatus !== "idle";
  const cardError = (() => {
    if (cardsQueryError) return cardsQueryError.message;
    if (!card && !cardsPending && rcNum && allCards.length > 0) {
      const target = digitsOnly(rcNum);
      if (!allCards.find((c) => digitsOnly(c.cm_card_number) === target)) {
        return "Card not found for this account.";
      }
    }
    return null;
  })();

  // If card not provided via router state, hydrate from the cards list.
  useEffect(() => {
    if (card || !rcNum || allCards.length === 0) return;
    const target = digitsOnly(rcNum);
    const found = allCards.find((c) => digitsOnly(c.cm_card_number) === target);
    if (found) setCard(found);
  }, [allCards, card, rcNum]);

  const txnParams = useMemo(() => {
    if (!rcNum) return undefined;
    const digits = rcNum.replace(/\D/g, "");
    const formattedRc = digits.replace(/(.{4})(?=.)/g, "$1 ");
    return { rcNum: formattedRc };
  }, [rcNum]);

  const {
    data: txnsRaw,
    isPending: txnsPending,
    fetchStatus: txnsFetchStatus,
    error: txnsError,
  } = useResource<unknown>("transactions", mobile && rcNum ? mobile : undefined, txnParams);
  const txns: Transaction[] | null = txnsRaw
    ? ((extractItems(txnsRaw) ?? []) as Transaction[])
    : null;
  const loading = txnsPending && txnsFetchStatus !== "idle";
  const error = txnsError ? txnsError.message : null;

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

  const currentIndex = allCards.findIndex(
    (c) => digitsOnly(c.cm_card_number) === digitsOnly(rcNum),
  );
  const prevCard = currentIndex > 0 ? allCards[currentIndex - 1] : null;
  const nextCard =
    currentIndex >= 0 && currentIndex < allCards.length - 1
      ? allCards[currentIndex + 1]
      : null;
  const prevPrevCard = currentIndex > 1 ? allCards[currentIndex - 2] : null;
  const nextNextCard =
    currentIndex >= 0 && currentIndex < allCards.length - 2
      ? allCards[currentIndex + 2]
      : null;

  const goToCard = (target: Record<string, unknown>) => {
    const num = String(target.cm_card_number ?? "");
    navigate(`/cards/${encodeURIComponent(num)}`, { state: { card: target }, replace: true });
  };

  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const locked = useRef<"h" | "v" | null>(null);
  const dxRef = useRef(0);
  const SWIPE_THRESHOLD = 70;
  const SWIPE_MAX = typeof window !== "undefined" ? Math.round(window.innerWidth * 0.5) : 200;

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
        className="px-5 pt-10 pb-6 text-primary-foreground [background:var(--gradient-primary)] dark:![background:hsl(var(--card)/0.85)] dark:!text-foreground dark:border-b dark:border-border/60 dark:backdrop-blur-md"
      >
        <div className="flex items-center justify-end mb-3">
          <button
            type="button"
            onClick={() => navigate("/notifications")}
            aria-label="Notifications"
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm text-primary-foreground ring-1 ring-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 hover:bg-white/25 transition-colors"
          >
            <Bell className="h-5 w-5" />
            {notifUnread > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-[18px] text-center ring-2 ring-[hsl(var(--primary))]">
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
      {(() => {
        const renderCardBody = (c: Record<string, unknown>) => (
          <Card className="p-5 bg-card/95 backdrop-blur shadow-[var(--shadow-card)] border-0">
            <div className="space-y-1.5">
              {fields.map(({ key, label }) => {
                const isName = key === "person_name";
                const isCardNumber = key === "cm_card_number";
                const hideLabel = isName || isCardNumber;
                const raw = c[key];
                const display = raw == null || raw === "" ? "—" : String(raw);
                return (
                  <div
                    key={key}
                    className={`flex justify-between gap-3 border-b border-border/50 py-1.5 last:border-0 ${isName ? "" : "text-sm"}`}
                  >
                    {!hideLabel && (
                      <span className="text-muted-foreground">{label}</span>
                    )}
                    <span
                      className={`break-all ${isName ? "font-bold text-foreground w-full text-right text-xl" : isCardNumber ? "text-foreground w-full text-right font-medium" : "text-muted-foreground text-right"}`}
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
        const PEEK = 25; // px of neighbor card edge visible on each side
        const GAP = 12;
        return (
          <div className="relative -mx-5 overflow-hidden px-5">
            <div
              className="relative mx-auto"
              style={{
                width: `calc(100% - ${PEEK * 2}px)`,
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
              {prevCard && (
                <div
                  aria-hidden
                  className="absolute inset-y-0"
                  style={{
                    width: "100%",
                    left: 0,
                    transform: `translateX(calc(-100% - ${GAP}px + ${swipeDx}px))`,
                    transition,
                  }}
                >
                  {renderCardBody(prevCard)}
                </div>
              )}
              {prevPrevCard && (
                <div
                  aria-hidden
                  className="absolute inset-y-0"
                  style={{
                    width: "100%",
                    left: 0,
                    transform: `translateX(calc(-200% - ${GAP * 2}px + ${swipeDx}px))`,
                    transition,
                  }}
                >
                  {renderCardBody(prevPrevCard)}
                </div>
              )}
              {nextCard && (
                <div
                  aria-hidden
                  className="absolute inset-y-0"
                  style={{
                    width: "100%",
                    left: 0,
                    transform: `translateX(calc(100% + ${GAP}px + ${swipeDx}px))`,
                    transition,
                  }}
                >
                  {renderCardBody(nextCard)}
                </div>
              )}
              {nextNextCard && (
                <div
                  aria-hidden
                  className="absolute inset-y-0"
                  style={{
                    width: "100%",
                    left: 0,
                    transform: `translateX(calc(200% + ${GAP * 2}px + ${swipeDx}px))`,
                    transition,
                  }}
                >
                  {renderCardBody(nextNextCard)}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {allCards.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 -mt-2">
          {allCards.map((c, i) => {
            const active = i === currentIndex;
            return (
              <button
                key={String(c.cm_card_number ?? i)}
                type="button"
                onClick={() => goToCard(c)}
                aria-label={`Go to card ${i + 1}`}
                aria-current={active}
                className={`h-1.5 rounded-full transition-all ${active ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/40 hover:bg-muted-foreground/60"}`}
              />
            );
          })}
        </div>
      )}



      <section>
        <h2 className="text-sm font-semibold text-foreground mb-3">Monthly Rashan</h2>
          {loading ? (
            <LoadingState label="Loading rashans..." />
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
                <TransactionCard key={getItemKey(t, i)} item={t} variant="compact" />
              ))}
            </div>
          )}
        </section>
      </main>
      <button
        type="button"
        onClick={() => navigate(-1)}
        aria-label="Back"
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-1 ring-primary/30 hover:bg-primary/90 transition-colors animate-in fade-in slide-in-from-bottom-2"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
      <PageFooter />
    </div>
  );
};

export default CardDetails;
