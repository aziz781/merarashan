import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

export interface StatItem {
  label: string;
  value: string;
  icon: LucideIcon;
  /** Optional status key; when provided, the tile is clickable. */
  status?: string;
}

interface Props {
  stats: StatItem[];
  activeStatus?: string;
  onStatClick?: (status: string) => void;
}

export function StatsGrid({ stats, activeStatus, onStatClick }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 mb-4">
      {stats.map(({ label, value, icon: Icon, status }) => {
        const clickable = !!status && !!onStatClick;
        const active = clickable && activeStatus === status && status !== "all";
        return (
          <Card
            key={label}
            onClick={clickable ? () => onStatClick!(status!) : undefined}
            role={clickable ? "button" : undefined}
            tabIndex={clickable ? 0 : undefined}
            onKeyDown={
              clickable
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onStatClick!(status!);
                    }
                  }
                : undefined
            }
            className={`p-4 border-border/50 bg-card/80 backdrop-blur shadow-[var(--shadow-soft)] ${
              clickable ? "cursor-pointer transition-transform hover:scale-[1.01] active:scale-[0.99]" : ""
            } ${active ? "ring-2 ring-primary border-primary bg-primary/5" : ""}`}
          >
            <div className={`flex items-center gap-2 mb-1 ${active ? "text-primary" : "text-muted-foreground"}`}>
              <Icon className="w-4 h-4" />
              <span className="text-xs font-medium">{label}</span>
            </div>
            <p className="text-lg font-bold text-foreground truncate">{value}</p>
          </Card>
        );
      })}
    </div>
  );
}
