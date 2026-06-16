import { CreditCard, Copy } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";

export function CardDetailsPopup({
  item,
  open,
  onOpenChange,
}: {
  item: Record<string, unknown> | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  if (!item) return null;

  const allowedKeys: { key: string; label: string }[] = [
    { key: "cm_card_number", label: "Card Number" },
    { key: "person_name", label: "Name" },
    { key: "amount", label: "Amount" },
    { key: "mobile_number", label: "Mobile" },
    { key: "city", label: "City" },
    { key: "reg_date", label: "Registration Date" },
  ];
  const entries = allowedKeys
    .map(({ key, label }) => [key, item[key], label] as const)
    .filter(([, v]) => v !== null && v !== "" && v !== undefined);

  const labelMap: Record<string, string> = Object.fromEntries(
    allowedKeys.map(({ key, label }) => [key, label]),
  );

  const formatValue = (key: string, raw: unknown): React.ReactNode => {
    if (raw == null || raw === "") return "—";
    if (key === "amount") {
      const n = Number(raw);
      return Number.isFinite(n) ? `Rs. ${n.toLocaleString("en-PK")}` : String(raw);
    }
    return String(raw);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2 pr-6">
            <span className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Card Details
            </span>
            <button
              type="button"
              aria-label="Copy all details"
              title="Copy all"
              onClick={async () => {
                const text = entries
                  .map(([key, value]) => `${labelMap[key] || key}: ${value ?? ""}`)
                  .join("\n");
                try {
                  if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
                  else {
                    const ta = document.createElement("textarea");
                    ta.value = text; document.body.appendChild(ta); ta.select();
                    document.execCommand("copy"); document.body.removeChild(ta);
                  }
                  toast({ title: "Copied all details" });
                } catch {
                  toast({ title: "Copy failed", variant: "destructive" });
                }
              }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <Copy className="w-4 h-4" />
              Copy all
            </button>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          {entries.map(([key, value], i) => {
            const hideLabel = key === "cm_card_number";
            return (
              <div key={key}>
                <div className="flex justify-between gap-3 text-sm items-start">
                  {!hideLabel && (
                    <span className="text-muted-foreground shrink-0">{labelMap[key] || key.replace(/_/g, " ")}</span>
                  )}
                  <span className={`font-medium text-foreground text-right break-all ${hideLabel ? "w-full" : ""}`}>{formatValue(key, value)}</span>
                </div>
                {i < entries.length - 1 && <Separator className="mt-3" />}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
