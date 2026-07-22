import { useEffect, useState } from "react";
import { Fingerprint, KeyRound } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  clearPin,
  hasPin,
  isBiometricAvailable,
  isLockEnabled,
  setLockEnabled,
  verifyBiometric,
  verifyPin,
} from "@/lib/biometricLock";
import { isNativeCapacitor } from "@/lib/isNative";
import { SetPinDialog } from "@/components/SetPinDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function BiometricLockSetting() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState(isLockEnabled());
  const [pinSet, setPinSet] = useState(hasPin());
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pendingEnable, setPendingEnable] = useState(false);
  const [confirmPinOpen, setConfirmPinOpen] = useState(false);
  const [confirmPin, setConfirmPin] = useState("");
  const [confirmError, setConfirmError] = useState<string | null>(null);

  useEffect(() => {
    if (!isNativeCapacitor) { setAvailable(false); return; }
    void isBiometricAvailable().then(setAvailable);
  }, []);

  const unsupported = !isNativeCapacitor;


  const finishEnable = () => {
    setLockEnabled(true);
    setEnabled(true);
    setPinSet(hasPin());
    toast.success("App lock enabled", {
      description: "You'll be asked to verify when you open the app.",
    });
  };

  const onToggle = async (next: boolean) => {
    if (next) {
      // Require a PIN so users can't lock themselves out if biometrics break.
      if (!hasPin()) {
        setPendingEnable(true);
        setPinDialogOpen(true);
        return;
      }
      // Verify biometric if available; otherwise accept PIN we just set.
      if (available) {
        const ok = await verifyBiometric("Enable app lock");
        if (!ok) {
          toast.error("Verification failed", { description: "App lock was not enabled." });
          return;
        }
      }
      finishEnable();
    } else {
      // Disabling: require biometric OR PIN.
      const bio = available ? await verifyBiometric("Disable app lock") : false;
      if (bio) {
        setLockEnabled(false);
        setEnabled(false);
        toast.success("App lock disabled");
      } else {
        // Fall back to PIN confirmation.
        setConfirmPin("");
        setConfirmError(null);
        setConfirmPinOpen(true);
      }
    }
  };

  const submitConfirmPin = async () => {
    const ok = await verifyPin(confirmPin);
    if (!ok) {
      setConfirmError("Wrong PIN.");
      return;
    }
    setLockEnabled(false);
    setEnabled(false);
    setConfirmPinOpen(false);
    toast.success("App lock disabled");
  };

  return (
    <div className="rounded-lg border border-border/60 bg-card/60 px-3 py-3 space-y-3">
      <div className="flex items-start gap-3">
        <Fingerprint className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">App lock</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {available === false
              ? "Biometrics unavailable — a PIN will be required."
              : "Use fingerprint or face, with a PIN fallback."}
          </p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(v) => void onToggle(v)}
          aria-label="Toggle app lock"
        />
      </div>

      <div className="flex items-center gap-3 pt-1 border-t border-border/40">
        <KeyRound className="w-4 h-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium">Fallback PIN</p>
          <p className="text-[11px] text-muted-foreground">
            {pinSet ? "PIN is set." : "No PIN set."}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => { setPendingEnable(false); setPinDialogOpen(true); }}
        >
          {pinSet ? "Change" : "Set PIN"}
        </Button>
        {pinSet && !enabled && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => { clearPin(); setPinSet(false); toast.success("PIN removed"); }}
          >
            Remove
          </Button>
        )}
      </div>

      <SetPinDialog
        open={pinDialogOpen}
        onOpenChange={(o) => { setPinDialogOpen(o); if (!o) setPendingEnable(false); }}
        onSaved={async () => {
          setPinSet(true);
          toast.success("PIN saved");
          if (pendingEnable) {
            if (available) {
              const ok = await verifyBiometric("Enable app lock");
              if (!ok) {
                toast.message("PIN saved — biometric not verified.", {
                  description: "Turn on the switch again once ready.",
                });
                return;
              }
            }
            finishEnable();
          }
        }}
      />

      <Dialog open={confirmPinOpen} onOpenChange={setConfirmPinOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Enter your PIN</DialogTitle>
            <DialogDescription>Confirm your PIN to disable the app lock.</DialogDescription>
          </DialogHeader>
          <Input
            type="password"
            inputMode="numeric"
            autoFocus
            value={confirmPin}
            maxLength={6}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="••••"
          />
          {confirmError && <p className="text-xs text-destructive">{confirmError}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmPinOpen(false)}>Cancel</Button>
            <Button onClick={() => void submitConfirmPin()}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
