import { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

// Detect native iOS (Capacitor) so we can give the title bar extra height,
// which looks better against the taller iOS status bar / notch.
const isNativeIOS =
  typeof window !== "undefined" &&
  ((window as unknown as { Capacitor?: { getPlatform?: () => string } })
    .Capacitor?.getPlatform?.() === "ios");

/**
 * Shared top-bar shell used by inner pages (Notifications, Rashan details,
 * Card details, Dashboard) so padding, height, and dark-mode treatment stay
 * consistent. Page-specific buttons/titles are passed as children.
 */
export function PageHeader({ children, className, style, ...rest }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "px-5 pb-2 text-primary-foreground [background:var(--gradient-primary)]",
        "dark:![background:hsl(var(--card)/0.85)] dark:!text-foreground dark:border-b dark:border-border/60 dark:backdrop-blur-md",
        className,
      )}
      style={{
        // On iOS we need the header to start well below the status bar / notch.
        // Use the safe-area inset, but never less than the classic 44px status bar,
        // plus an extra 1.5rem so the title text never touches the notch.
        paddingTop: isNativeIOS
          ? "calc(max(env(safe-area-inset-top), 44px) + 1.5rem)"
          : "calc(env(safe-area-inset-top) + 0.75rem)",
        minHeight: isNativeIOS ? 164 : 104,
        ...style,
      }}
      {...rest}
    >
      {children}
    </header>
  );
}
