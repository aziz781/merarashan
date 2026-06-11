import { useNavigate, useLocation } from "react-router-dom";
import { User, ArrowLeftRight, CreditCard, FileText } from "lucide-react";

type TabId = "customers" | "transactions" | "cards" | "statements";

const TABS: { id: TabId; label: string; icon: typeof CreditCard }[] = [
  { id: "customers", label: "Home", icon: User },
  { id: "transactions", label: "Rashans", icon: ArrowLeftRight },
  { id: "cards", label: "Cards", icon: CreditCard },
  { id: "statements", label: "Statements", icon: FileText },
];

type Props = {
  activeTab?: TabId;
  onSelect?: (id: TabId) => void;
};

export function BottomNav({ activeTab, onSelect }: Props) {
  const navigate = useNavigate();
  const location = useLocation();

  let current: TabId | undefined = activeTab;
  if (!current) {
    try {
      const saved = sessionStorage.getItem("activeTab");
      if (saved) current = saved as TabId;
    } catch {
      /* ignore */
    }
  }

  const handleClick = (id: TabId) => {
    if (onSelect) {
      onSelect(id);
      return;
    }
    try {
      sessionStorage.setItem("activeTab", id);
    } catch {
      /* ignore */
    }
    if (location.pathname !== "/") {
      navigate("/");
    }
  };

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 border-t border-border/60 bg-card/85 backdrop-blur-md shadow-[0_-4px_20px_-8px_hsl(var(--foreground)/0.15)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary"
    >
      <div className="mx-auto max-w-2xl grid grid-cols-4 h-16">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = current === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => handleClick(id)}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span
                className={`flex items-center justify-center w-12 h-7 rounded-full transition-colors ${
                  active ? "bg-primary/15 ring-1 ring-primary/30" : ""
                }`}
              >
                <Icon className="w-5 h-5" />
              </span>
              <span className={`text-[10px] ${active ? "font-semibold text-primary" : "font-medium"}`}>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
