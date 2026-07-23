// Biometric app lock — native only. On app launch, if the user has enabled
// the lock in Settings, gate the app behind a fingerprint/FaceID prompt with
// a numeric PIN fallback for when biometrics aren't available or fail.
import { isNativeCapacitor } from "@/lib/isNative";

const ENABLED_KEY = "mr_biometric_lock_enabled";
const PIN_HASH_KEY = "mr_biometric_lock_pin_hash";
const PIN_SALT_KEY = "mr_biometric_lock_pin_salt";

export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 4;


type BiometricModule = {
  NativeBiometric: {
    isAvailable: (opts?: { useFallback: boolean }) => Promise<{
      isAvailable: boolean;
      biometryType?: number;
      strongBiometryIsAvailable?: boolean;
    }>;
    verifyIdentity: (opts: {
      reason?: string;
      title?: string;
      subtitle?: string;
      description?: string;
      negativeButtonText?: string;
      useFallback?: boolean;
      fallbackTitle?: string;
    }) => Promise<void>;
  };
};

async function loadBiometric(): Promise<BiometricModule | null> {
  if (!isNativeCapacitor) return null;
  try {
    return (await import("@capgo/capacitor-native-biometric")) as unknown as BiometricModule;
  } catch {
    return null;
  }
}

export async function isBiometricAvailable(): Promise<boolean> {
  const mod = await loadBiometric();
  if (!mod) return false;
  try {
    const r = await mod.NativeBiometric.isAvailable({ useFallback: false });
    return !!(r?.strongBiometryIsAvailable ?? r?.isAvailable);
  } catch {
    return false;
  }
}

export function isLockEnabled(): boolean {
  if (!isNativeCapacitor) return false;
  try { return localStorage.getItem(ENABLED_KEY) === "1"; } catch { return false; }
}

export function setLockEnabled(v: boolean) {
  try {
    if (v) localStorage.setItem(ENABLED_KEY, "1");
    else localStorage.removeItem(ENABLED_KEY);
  } catch { /* ignore */ }
}

export async function verifyBiometric(reason = "Unlock Mera Rashan"): Promise<boolean> {
  const mod = await loadBiometric();
  if (!mod) return true; // Non-native: pass-through.
  try {
    await mod.NativeBiometric.verifyIdentity({
      reason,
      title: "Mera Rashan",
      subtitle: "Verify to unlock",
      description: reason,
      negativeButtonText: "Cancel",
      useFallback: false,
    });
    return true;
  } catch {
    return false;
  }
}

// ---------- PIN fallback ----------

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPin(pin: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`${saltHex}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
}

export function hasPin(): boolean {
  try {
    return !!localStorage.getItem(PIN_HASH_KEY) && !!localStorage.getItem(PIN_SALT_KEY);
  } catch {
    return false;
  }
}

export async function setPin(pin: string): Promise<void> {
  if (!/^\d+$/.test(pin) || pin.length < PIN_MIN_LENGTH || pin.length > PIN_MAX_LENGTH) {
    throw new Error(`PIN must be ${PIN_MIN_LENGTH}–${PIN_MAX_LENGTH} digits`);
  }
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = toHex(saltBytes.buffer);
  const hash = await hashPin(pin, saltHex);
  try {
    localStorage.setItem(PIN_SALT_KEY, saltHex);
    localStorage.setItem(PIN_HASH_KEY, hash);
  } catch { /* ignore */ }
}

export function clearPin(): void {
  try {
    localStorage.removeItem(PIN_HASH_KEY);
    localStorage.removeItem(PIN_SALT_KEY);
  } catch { /* ignore */ }
}

export async function verifyPin(pin: string): Promise<boolean> {
  try {
    const salt = localStorage.getItem(PIN_SALT_KEY);
    const stored = localStorage.getItem(PIN_HASH_KEY);
    if (!salt || !stored) return false;
    const hash = await hashPin(pin, salt);
    // Constant-time-ish compare.
    if (hash.length !== stored.length) return false;
    let diff = 0;
    for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ stored.charCodeAt(i);
    return diff === 0;
  } catch {
    return false;
  }
}
