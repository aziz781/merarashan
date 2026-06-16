import { useCallback, useRef } from "react";

export function useLongPress(callback: () => void, duration = 600) {
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
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const isTriggered = useCallback(() => {
    const t = triggeredRef.current;
    triggeredRef.current = false;
    return t;
  }, []);

  return { start, cancel, isTriggered };
}
