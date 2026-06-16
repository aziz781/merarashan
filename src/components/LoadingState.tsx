import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  label?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizes = {
  sm: "h-5 w-5",
  md: "h-8 w-8",
  lg: "h-10 w-10",
};

/**
 * Standardized loading indicator: centered spinner with optional label.
 * Use everywhere in place of ad-hoc spinners / skeleton stacks for list loads.
 */
export function LoadingState({ label, className, size = "md" }: LoadingStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2 className={cn("animate-spin text-primary", sizes[size])} />
      {label && <p className="text-sm">{label}</p>}
    </div>
  );
}
