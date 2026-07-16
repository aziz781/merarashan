// Biometric app lock — native only. On app launch, if the user has enabled
// the lock in Settings, gate the app behind a fingerprint/FaceID prompt.
import { isNativeCapacitor } from "@/lib/isNative";

const ENABLED_KEY = "mr_biometric_lock_enabled";

type BiometricModule = {
  NativeBiometric: {
    isAvailable: () => Promise<{ isAvailable: boolean; biometryType?: number }>;
    verifyIdentity: (opts: {
      reason?: string;
      title?: string;
      subtitle?: string;
      description?: string;
      negativeButtonText?: string;
    }) => Promise<void>;
  };
};

async function loadBiometric(): Promise<BiometricModule | null> {
  if (!isNativeCapacitor) return null;
  try {
    return (await import("capacitor-native-biometric")) as unknown as BiometricModule;
  } catch {
    return null;
  }
}

export async function isBiometricAvailable(): Promise<boolean> {
  const mod = await loadBiometric();
  if (!mod) return false;
  try {
    const r = await mod.NativeBiometric.isAvailable();
    return !!r?.isAvailable;
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
    });
    return true;
  } catch {
    return false;
  }
}
