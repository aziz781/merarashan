import { useRef } from "react";
import type { TouchEvent } from "react";

type Direction = "left" | "right" | "up" | "down";

interface Options {
  direction: Direction;
  onClose: () => void;
  threshold?: number;
  enabled?: boolean;
}

/**
 * Returns touch handlers that close a panel when the user swipes
 * past `threshold` (default 60px) in the given direction, as long as
 * the dominant axis matches.
 */
export function useSwipeToClose({
  direction,
  onClose,
  threshold = 60,
  enabled = true,
}: Options) {
  const start = useRef<{ x: number; y: number } | null>(null);

  if (!enabled) {
    return {
      onTouchStart: undefined,
      onTouchMove: undefined,
      onTouchEnd: undefined,
    };
  }

  return {
    onTouchStart: (e: TouchEvent) => {
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY };
    },
    onTouchMove: (e: TouchEvent) => {
      if (!start.current) return;
      const t = e.touches[0];
      const dx = t.clientX - start.current.x;
      const dy = t.clientY - start.current.y;
      const horizontal = Math.abs(dx) > Math.abs(dy);
      let fired = false;
      if (direction === "right" && horizontal && dx > threshold) fired = true;
      else if (direction === "left" && horizontal && dx < -threshold) fired = true;
      else if (direction === "down" && !horizontal && dy > threshold) fired = true;
      else if (direction === "up" && !horizontal && dy < -threshold) fired = true;
      if (fired) {
        start.current = null;
        onClose();
      }
    },
    onTouchEnd: () => {
      start.current = null;
    },
  };
}
