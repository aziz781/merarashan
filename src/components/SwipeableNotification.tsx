import { useRef, useState, type ReactNode, type PointerEvent } from "react";
import { Check, Trash2 } from "lucide-react";

type Props = {
  children: ReactNode;
  onDelete: () => void;
  onMarkRead: () => void;
  onTap?: () => void;
  disabled?: boolean;
};

const THRESHOLD = 80;
const MAX = 140;

export function SwipeableNotification({ children, onDelete, onMarkRead, onTap, disabled }: Props) {
  const [dx, setDxState] = useState(0);
  const [animating, setAnimating] = useState(false);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const locked = useRef<"h" | "v" | null>(null);
  const dxRef = useRef(0);

  const setDx = (v: number) => {
    dxRef.current = v;
    setDxState(v);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    startX.current = e.clientX;
    startY.current = e.clientY;
    locked.current = null;
    setAnimating(false);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (startX.current === null || startY.current === null) return;
    const deltaX = e.clientX - startX.current;
    const deltaY = e.clientY - startY.current;
    if (locked.current === null) {
      if (Math.abs(deltaX) < 6 && Math.abs(deltaY) < 6) return;
      locked.current = Math.abs(deltaX) > Math.abs(deltaY) ? "h" : "v";
    }
    if (locked.current !== "h") return;
    const clamped = Math.max(-MAX, Math.min(MAX, deltaX));
    setDx(clamped);
  };

  const finish = () => {
    const d = dxRef.current;
    startX.current = null;
    startY.current = null;
    setAnimating(true);
    if (d <= -THRESHOLD) {
      setDx(-window.innerWidth);
      setTimeout(onDelete, 180);
    } else if (d >= THRESHOLD) {
      setDx(0);
      onMarkRead();
    } else {
      setDx(0);
    }
    locked.current = null;
  };

  const showLeft = dx > 0;
  const showRight = dx < 0;

  return (
    <div className="relative overflow-hidden rounded-lg select-none">
      {/* Mark read (swipe right) */}
      <div
        className={`absolute inset-y-0 left-0 flex items-center justify-start pl-5 bg-green-500 text-white transition-opacity ${
          showLeft ? "opacity-100" : "opacity-0"
        }`}
        style={{ width: Math.max(0, dx) }}
        aria-hidden
      >
        <Check className="h-5 w-5" />
      </div>
      {/* Delete (swipe left) */}
      <div
        className={`absolute inset-y-0 right-0 flex items-center justify-end pr-5 bg-destructive text-destructive-foreground transition-opacity ${
          showRight ? "opacity-100" : "opacity-0"
        }`}
        style={{ width: Math.max(0, -dx) }}
        aria-hidden
      >
        <Trash2 className="h-5 w-5" />
      </div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        style={{
          transform: `translateX(${dx}px)`,
          transition: animating ? "transform 180ms ease-out" : "none",
          touchAction: "pan-y",
        }}
      >
        {children}
      </div>
    </div>
  );
}
