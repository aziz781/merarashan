import { Type, Contrast } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useAccessibility, type FontSize } from "@/hooks/use-accessibility";

const OPTIONS: { value: FontSize; label: string; sample: string }[] = [
  { value: "normal", label: "Normal", sample: "A" },
  { value: "large", label: "Large", sample: "A" },
  { value: "xlarge", label: "Extra Large", sample: "A" },
];

export function AccessibilitySettings() {
  const { fontSize, setFontSize, highContrast, setHighContrast } = useAccessibility();

  return (
    <>
      <Card className="p-4 bg-card/80 backdrop-blur shadow-[var(--shadow-soft)] border-border/50">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Type className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Text Size</p>
            <p className="text-xs text-muted-foreground">Larger text is easier to read</p>
          </div>
        </div>
        <div role="radiogroup" aria-label="Text size" className="grid grid-cols-3 gap-2">
          {OPTIONS.map((opt) => {
            const active = fontSize === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setFontSize(opt.value)}
                className={`flex flex-col items-center justify-center gap-1 rounded-lg border px-2 py-3 min-h-[64px] transition-colors ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-foreground hover:bg-muted"
                }`}
              >
                <span
                  className={
                    opt.value === "normal"
                      ? "text-base font-semibold"
                      : opt.value === "large"
                      ? "text-xl font-semibold"
                      : "text-2xl font-bold"
                  }
                >
                  {opt.sample}
                </span>
                <span className="text-[11px] font-medium">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="p-4 bg-card/80 backdrop-blur shadow-[var(--shadow-soft)] border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Contrast className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">High Contrast</p>
            <p className="text-xs text-muted-foreground">
              {highContrast ? "Stronger colors enabled" : "Standard colors"}
            </p>
          </div>
          <Switch
            checked={highContrast}
            onCheckedChange={setHighContrast}
            aria-label="Toggle high contrast"
          />
        </div>
      </Card>
    </>
  );
}
