import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, User, ArrowLeftRight, CreditCard, FileText, LogOut } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type NavItem = { id: string; label: string; icon: typeof User };

const NAV_ITEMS: NavItem[] = [
  { id: "customers", label: "Home", icon: User },
  { id: "transactions", label: "Rashans", icon: ArrowLeftRight },
  { id: "cards", label: "Cards", icon: CreditCard },
  { id: "statements", label: "Statements", icon: FileText },
];

interface SideMenuProps {
  onLogout?: () => void;
  triggerClassName?: string;
}

export function SideMenu({ onLogout, triggerClassName }: SideMenuProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const go = (tabId: string) => {
    try {
      sessionStorage.setItem("activeTab", tabId);
    } catch (_) {
      /* ignore */
    }
    setOpen(false);
    navigate("/");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className={
          triggerClassName ||
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm text-primary-foreground ring-1 ring-white/25 hover:bg-white/25 transition-colors"
        }
      >
        <Menu className="w-5 h-5" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 flex flex-col">
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>

          <div className="flex flex-col gap-1 mt-4">
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => go(id)}
                className="flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm hover:bg-muted transition-colors"
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </button>
            ))}

            {onLogout && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onLogout();
                }}
                className="mt-2 flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm hover:bg-muted transition-colors text-destructive"
              >
                <LogOut className="w-4 h-4" />
                <span>Log out</span>
              </button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
