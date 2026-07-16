import { useEffect, useState } from "react";
import { Fingerprint } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { isBiometricAvailable, isLockEnabled, setLockEnabled, verifyBiometric } from "@/lib/biometricLock";
import { isNativeCapacitor } from "@/lib/isNative";

export function BiometricLockSetting() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState(isLockEnabled());

  useEffect(() => {
    if (!isNativeCapacitor) { setAvailable(false); return; }
    void isBiometricAvailable().then(setAvailable);
  }, []);

  if (!isNativeCapacitor) return null;

  const onToggle = async (next: boolean) => {
    if (next) {
      // Verify once before turning on so the user can't lock themselves out.
      const ok = await verifyBiometric("Enable biometric app lock");
      if (!ok) {
        toast.error("Verification failed", { description: "Biometric lock was not enabled." });
        return;
      }
      setLockEnabled(true);
      setEnabled(true);
      toast.success("Biometric lock enabled", {
        description: "You'll be asked to verify when you open the app.",
      });
    } else {
      const ok = await verifyBiometric("Disable biometric app lock");
      if (!ok) {
        toast.error("Verification failed", { description: "Biometric lock is still enabled." });
        return;
      }
      setLockEnabled(false);
      setEnabled(false);
      toast.success("Biometric lock disabled");
    }
  };

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-card/60 px-3 py-3">
      <Fingerprint className="w-5 h-5 text-primary shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">Biometric app lock</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {available === false
            ? "Not available on this device."
            : "Require fingerprint or face to open the app."}
        </p>
      </div>
      <Switch
        checked={enabled}
        disabled={available !== true}
        onCheckedChange={(v) => void onToggle(v)}
        aria-label="Toggle biometric app lock"
      />
    </div>
  );
}
