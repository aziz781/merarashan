import { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Info, CheckCircle2, X, AlertTriangle } from "lucide-react";

export type MessageType = "INFO" | "WARNING" | "SUCCESS" | "FAILURE";

interface MessageBoxProps {
  type?: MessageType | string;
  title?: string;
  message: ReactNode;
}

export function MessageBox({ type = "INFO", title, message }: MessageBoxProps) {
  const msgType = String(type ?? "").toUpperCase() as MessageType;
  const isInfo = msgType === "INFO";
  const isWarning = msgType === "WARNING";
  const isSuccess = msgType === "SUCCESS";
  const isFailed = msgType === "FAILURE";

  const borderClass = isWarning
    ? "border-yellow-500/30"
    : isSuccess
      ? "border-green-500/30"
      : isFailed
        ? "border-destructive/30"
        : "border-primary/30";

  const bgClass = isWarning
    ? "bg-yellow-500/5"
    : isSuccess
      ? "bg-green-500/5"
      : isFailed
        ? "bg-destructive/5"
        : "bg-primary/5";

  const textClass = isWarning
    ? "text-yellow-600"
    : isSuccess
      ? "text-green-600"
      : isFailed
        ? "text-destructive"
        : "text-primary";

  const Icon = isWarning ? AlertTriangle : isSuccess ? CheckCircle2 : isFailed ? X : Info;

  return (
    <Card className={`p-4 ${borderClass} ${bgClass} shadow-[var(--shadow-soft)]`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 ${textClass} shrink-0 mt-0.5`} />
        <div className="flex-1">
          <p className={`text-xs uppercase tracking-wider ${textClass} mb-1 font-semibold`}>
            {title ? String(title) : "Message"}
          </p>
          <p className="text-sm text-foreground whitespace-pre-wrap break-words">{String(message)}</p>
        </div>
      </div>
    </Card>
  );
}
