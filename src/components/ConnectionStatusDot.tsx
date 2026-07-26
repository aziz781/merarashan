import { useEffect, useState } from "react";
import { Wifi, WifiOff, AlertTriangle } from "lucide-react";
import { subscribeNetworkIssue } from "@/lib/networkStatus";

type Status = "online" | "offline" | "issue";

const ISSUE_WINDOW_MS = 8000;

export function ConnectionStatusDot() {
  const [online, setOnline] = useState<boolean>(
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const [issueAt, setIssueAt] = useState(0);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    return subscribeNetworkIssue((at) => setIssueAt(at));
  }, []);

  // Auto-clear stale issue flag
  useEffect(() => {
    if (!issueAt) return;
    const t = setTimeout(() => setIssueAt(0), ISSUE_WINDOW_MS);
    return () => clearTimeout(t);
  }, [issueAt]);

  const status: Status = !online
    ? "offline"
    : issueAt && Date.now() - issueAt < ISSUE_WINDOW_MS
      ? "issue"
      : "online";

  const config = {
    online: {
      label: "Online",
      Icon: Wifi,
      dot: "bg-green-400",
      ring: "ring-green-300/40",
      bg: "bg-green-400/15",
      text: "text-green-50",
    },
    offline: {
      label: "Offline",
      Icon: WifiOff,
      dot: "bg-red-400",
      ring: "ring-red-300/40",
      bg: "bg-red-400/20",
      text: "text-red-50",
    },
    issue: {
      label: "Network issue",
      Icon: AlertTriangle,
      dot: "bg-amber-300",
      ring: "ring-amber-200/40",
      bg: "bg-amber-400/20",
      text: "text-amber-50",
    },
  }[status];

  const Icon = config.Icon;

  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={`Connection: ${config.label}`}
      title={config.label}
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ${config.bg} ${config.ring} ${config.text}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${config.dot} ${status === "online" ? "" : "animate-pulse"}`}
      />
      <Icon className="shrink-0" size={10} strokeWidth={2.5} />
    </span>
  );
}
