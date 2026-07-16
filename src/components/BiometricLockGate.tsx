import { useEffect, useState } from "react";
import { Fingerprint, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isLockEnabled, verifyBiometric } from "@/lib/biometricLock";
import { isNativeCapacitor } from "@/lib/isNative";

/**
 * Gates the app behind a biometric prompt on native launch when the user has
 * enabled the lock in Settings. Only prompts once per app launch (not on
 * resume from background). Renders `children` after successful unlock.
 */
export function BiometricLockGate({ children }: { children: React.ReactNode }) {
  const enabled = isNativeCapacitor && isLockEnabled();
  const [unlocked, setUnlocked] = useState(!enabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const attempt = async () => {
    setBusy(true);
    setError(null);
    const ok = await verifyBiometric("Unlock Mera Rashan to continue");
    setBusy(false);
    if (ok) setUnlocked(true);
    else setError("Authentication failed. Please try again.");
  };

  useEffect(() => {
    if (!enabled || unlocked) return;
    void attempt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (unlocked) return <>{children}</>;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-background">
      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Fingerprint className="w-10 h-10 text-primary" />
      </div>
      <h1 className="text-lg font-semibold mb-1">Mera Rashan is locked</h1>
      <p className="text-sm text-muted-foreground mb-5 max-w-xs">
        Verify with your fingerprint or face to unlock the app.
      </p>
      {error && <p className="text-xs text-destructive mb-3">{error}</p>}
      <Button onClick={attempt} disabled={busy} size="lg">
        {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Fingerprint className="w-4 h-4 mr-2" />}
        Unlock
      </Button>
    </div>
  );
}
