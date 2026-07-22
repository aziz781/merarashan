import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { setPin } from "@/lib/biometricLock";

const PIN_LENGTH = 4;

interface SetPinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  title?: string;
  description?: string;
}

interface PinBoxesProps {
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  ariaLabel: string;
}

function PinBoxes({ value, onChange, autoFocus, ariaLabel }: PinBoxesProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: PIN_LENGTH }, (_, i) => value[i] ?? "");

  useEffect(() => {
    if (autoFocus) {
      // Delay to let dialog mount
      const t = setTimeout(() => refs.current[0]?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  const setDigit = (i: number, d: string) => {
    const cleaned = d.replace(/\D/g, "");
    if (!cleaned) {
      // clear
      const next = (value.slice(0, i) + value.slice(i + 1)).slice(0, PIN_LENGTH);
      onChange(next);
      return;
    }
    const ch = cleaned[cleaned.length - 1];
    const arr = digits.slice();
    arr[i] = ch;
    onChange(arr.join("").slice(0, PIN_LENGTH));
    if (i < PIN_LENGTH - 1) refs.current[i + 1]?.focus();
  };

  return (
    <div role="group" aria-label={ariaLabel} className="flex justify-between gap-2">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={d}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !digits[i] && i > 0) {
              refs.current[i - 1]?.focus();
            } else if (e.key === "ArrowLeft" && i > 0) {
              refs.current[i - 1]?.focus();
            } else if (e.key === "ArrowRight" && i < PIN_LENGTH - 1) {
              refs.current[i + 1]?.focus();
            }
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, PIN_LENGTH);
            if (text) {
              e.preventDefault();
              onChange(text);
              refs.current[Math.min(text.length, PIN_LENGTH - 1)]?.focus();
            }
          }}
          className="w-12 h-14 text-center text-2xl font-semibold rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
      ))}
    </div>
  );
}

export function SetPinDialog({
  open,
  onOpenChange,
  onSaved,
  title = "Set PIN",
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

  const submit = async () => {
    setError(null);
    if (pin1.length !== PIN_LENGTH) {
      setError(`PIN must be ${PIN_LENGTH} digits.`);
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
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              New {PIN_LENGTH}-digit PIN
            </label>
            <PinBoxes value={pin1} onChange={setPin1} autoFocus ariaLabel="New PIN" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Confirm PIN</label>
            <PinBoxes value={pin2} onChange={setPin2} ariaLabel="Confirm PIN" />
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
