import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PIN_MAX_LENGTH, PIN_MIN_LENGTH, setPin } from "@/lib/biometricLock";

interface SetPinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  title?: string;
  description?: string;
}

export function SetPinDialog({
  open,
  onOpenChange,
  onSaved,
  title = "Set fallback PIN",
  description = "Used when biometrics aren't available or fail repeatedly.",
}: SetPinDialogProps) {
  const [pin1, setPin1] = useState("");
  const [pin2, setPin2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setPin1("");
      setPin2("");
      setError(null);
      setBusy(false);
    }
  }, [open]);

  const clean = (v: string) => v.replace(/\D/g, "").slice(0, PIN_MAX_LENGTH);

  const submit = async () => {
    setError(null);
    if (pin1.length < PIN_MIN_LENGTH) {
      setError(`PIN must be at least ${PIN_MIN_LENGTH} digits.`);
      return;
    }
    if (pin1 !== pin2) {
      setError("PINs don't match.");
      return;
    }
    setBusy(true);
    try {
      await setPin(pin1);
      onSaved();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save PIN.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              New PIN ({PIN_MIN_LENGTH}–{PIN_MAX_LENGTH} digits)
            </label>
            <Input
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              value={pin1}
              onChange={(e) => setPin1(clean(e.target.value))}
              placeholder="••••"
              maxLength={PIN_MAX_LENGTH}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Confirm PIN</label>
            <Input
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              value={pin2}
              onChange={(e) => setPin2(clean(e.target.value))}
              placeholder="••••"
              maxLength={PIN_MAX_LENGTH}
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={busy}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save PIN
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
