interface TypingIndicatorProps {
  label: string;
  align?: "left" | "right";
}

export function TypingIndicator({ label, align = "left" }: TypingIndicatorProps) {
  return (
    <div className={`flex ${align === "right" ? "justify-end" : "justify-start"}`} aria-live="polite">
      <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-border bg-muted px-4 py-2.5">
        <span className="flex items-center gap-1">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 animate-bounce"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}
