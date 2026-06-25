import { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * Shared top-bar shell used by inner pages (Notifications, Rashan details,
 * Card details, Dashboard) so padding, height, and dark-mode treatment stay
 * consistent. Page-specific buttons/titles are passed as children.
 */
export function PageHeader({ children, className, style, ...rest }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "px-5 pt-10 pb-6 text-primary-foreground [background:var(--gradient-primary)]",
        "dark:![background:hsl(var(--card)/0.85)] dark:!text-foreground dark:border-b dark:border-border/60 dark:backdrop-blur-md",
        className,
      )}
      style={{ minHeight: 132, ...style }}
      {...rest}
    >
      {children}
    </header>
  );
}
