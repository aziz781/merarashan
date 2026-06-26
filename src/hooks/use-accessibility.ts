import { useCallback, useEffect, useState } from "react";
import { safeLocal } from "@/lib/safeStorage";

export type FontSize = "normal" | "large" | "xlarge";

const FONT_KEY = "mr_font_size";
const CONTRAST_KEY = "mr_high_contrast";

function getInitialFontSize(): FontSize {
  if (typeof window === "undefined") return "normal";
  const v = safeLocal.get(FONT_KEY);
  return v === "large" || v === "xlarge" ? v : "normal";
}

function getInitialContrast(): boolean {
  if (typeof window === "undefined") return false;
  return safeLocal.get(CONTRAST_KEY) === "1";
}

function applyFontSize(size: FontSize) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("font-size-large", "font-size-xlarge");
  if (size === "large") root.classList.add("font-size-large");
  if (size === "xlarge") root.classList.add("font-size-xlarge");
}

function applyContrast(enabled: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("high-contrast", enabled);
}

// Apply once at module load to avoid flash.
if (typeof window !== "undefined") {
  applyFontSize(getInitialFontSize());
  applyContrast(getInitialContrast());
}

export function useAccessibility() {
  const [fontSize, setFontSizeState] = useState<FontSize>(getInitialFontSize);
  const [highContrast, setHighContrastState] = useState<boolean>(getInitialContrast);

  useEffect(() => {
    applyFontSize(fontSize);
    safeLocal.set(FONT_KEY, fontSize);
  }, [fontSize]);

  useEffect(() => {
    applyContrast(highContrast);
    safeLocal.set(CONTRAST_KEY, highContrast ? "1" : "0");
  }, [highContrast]);

  const setFontSize = useCallback((s: FontSize) => setFontSizeState(s), []);
  const setHighContrast = useCallback((v: boolean) => setHighContrastState(v), []);

  return { fontSize, setFontSize, highContrast, setHighContrast };
}
