import { useEffect, useRef, useState } from "react";
import { Fingerprint, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  hasPin,
  isBiometricAvailable,
  isLockEnabled,
  verifyBiometric,
  verifyPin,
} from "@/lib/biometricLock";
import { isNativeCapacitor } from "@/lib/isNative";

const MAX_BIO_FAILS = 3;

/**
 * Gates the app behind a biometric prompt on native launch when the user has
 * enabled the lock in Settings. Falls back to a numeric PIN when biometrics
 * aren't available or the user fails repeatedly. Only prompts once per app
 * launch (not on resume from background).
 */
export function BiometricLockGate({ children }: { children: React.ReactNode }) {
  const enabled = isNativeCapacitor && isLockEnabled();
  const [unlocked, setUnlocked] = useState(!enabled);
  const [busy, setBusy] = useState(false);
  const [bioAvailable, setBioAvailable] = useState<boolean | null>(null);
  const [mode, setMode] = useState<"bio" | "pin">("bio");
  const [error, setError] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const failsRef = useRef(0);
  const pinAvailable = hasPin();

  useEffect(() => {
    if (!enabled || unlocked) return;
    void (async () => {
      const avail = await isBiometricAvailable();
      setBioAvailable(avail);
      if (avail) {
        void attemptBiometric();
      } else if (pinAvailable) {
        setMode("pin");
      } else {
        // Lock enabled but neither biometric nor PIN usable — fail open to
        // avoid soft-locking the user.
        setUnlocked(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const attemptBiometric = async () => {
    setBusy(true);
    setError(null);
    const ok = await verifyBiometric("Unlock Mera Rashan to continue");
    setBusy(false);
    if (ok) {
      setUnlocked(true);
      return;
    }
    failsRef.current += 1;
    if (failsRef.current >= MAX_BIO_FAILS && pinAvailable) {
      setMode("pin");
      setError("Too many failed attempts. Enter your PIN.");
    } else {
      setError("Authentication failed. Please try again.");
    }
  };

  const submitPin = async () => {
    setBusy(true);
    setError(null);
    const ok = await verifyPin(pin);
    setBusy(false);
    if (ok) {
      setUnlocked(true);
    } else {
      setError("Wrong PIN. Try again.");
      setPin("");
    }
  };

  if (unlocked) return <>{children}</>;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-background">
      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        {mode === "bio" ? (
          <Fingerprint className="w-10 h-10 text-primary" />
        ) : (
          <KeyRound className="w-10 h-10 text-primary" />
        )}
      </div>
      <h1 className="text-lg font-semibold mb-1">Mera Rashan is locked</h1>
      <p className="text-sm text-muted-foreground mb-5 max-w-xs">
        {mode === "bio"
          ? "Verify with your fingerprint or face to unlock the app."
          : "Enter your PIN to unlock the app."}
      </p>
      {error && <p className="text-xs text-destructive mb-3">{error}</p>}

      {mode === "bio" ? (
        <>
          <Button onClick={attemptBiometric} disabled={busy} size="lg">
            {busy
              ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              : <Fingerprint className="w-4 h-4 mr-2" />}
            Unlock
          </Button>
          {pinAvailable && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-3"
              onClick={() => { setMode("pin"); setError(null); }}
            >
              <KeyRound className="w-4 h-4 mr-2" />
              Use PIN instead
            </Button>
          )}
        </>
      ) : (
        <div className="w-full max-w-xs space-y-3">
          <Input
            type="password"
            inputMode="numeric"
            autoFocus
            value={pin}
            maxLength={6}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            onKeyDown={(e) => { if (e.key === "Enter") void submitPin(); }}
            placeholder="••••"
            className="text-center text-2xl tracking-[0.5em]"
          />
          <Button onClick={() => void submitPin()} disabled={busy || pin.length < 4} className="w-full" size="lg">
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Unlock
          </Button>
          {bioAvailable && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => { setMode("bio"); setError(null); setPin(""); void attemptBiometric(); }}
            >
              <Fingerprint className="w-4 h-4 mr-2" />
              Use biometrics
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
