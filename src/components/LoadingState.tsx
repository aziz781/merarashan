import { cn } from "@/lib/utils";
import meraRashanLogo from "@/assets/mera-rashan-logo.webp";

interface LoadingStateProps {
  label?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizes = {
  sm: "h-8 w-8",
  md: "h-14 w-14",
  lg: "h-20 w-20",
};

/**
 * Standardized loading indicator: spinning Mera Rashan logo with optional label.
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
      <img
        src={meraRashanLogo}
        alt="Loading"
        className={cn("animate-spin rounded-full object-contain", sizes[size])}
        style={{ animationDuration: "1.5s" }}
      />
      {label && <p className="text-sm">{label}</p>}
    </div>
  );
}
