import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, Copy, HelpCircle, Info, LogOut, Settings, Share2, Shield, User } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useSwipeToClose } from "@/hooks/use-swipe-to-close";
import { toast } from "@/hooks/use-toast";
import { AppVersionInfo } from "@/components/AppVersionInfo";
import { AboutModal } from "@/components/AboutModal";

interface SideMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  displayName: string;
  payerId?: string | number | null;
  onOpenProfile: () => void;
  onOpenHelp: () => void;
  onOpenSettings: () => void;
  onOpenPrivacy: () => void;
  onOpenSocial: () => void;
  
  onLogout: () => void;
}

export function SideMenu({
  open,
  onOpenChange,
  displayName,
  payerId,
  onOpenProfile,
  onOpenHelp,
  onOpenSettings,
  onOpenPrivacy,
  onOpenSocial,
  
  onLogout,
}: SideMenuProps) {
  const [aboutOpen, setAboutOpen] = useState(false);
  const swipe = useSwipeToClose({
    direction: "left",
    onClose: () => onOpenChange(false),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-72 flex flex-col" {...swipe}>
        <SheetHeader>
          <SheetTitle className="truncate">{displayName}</SheetTitle>
        </SheetHeader>
        {payerId != null && payerId !== "" && (
          <div className="mt-4 flex items-center gap-2 rounded-md border border-border/60 bg-muted/40 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Customer number
              </p>
              <p className="text-sm font-semibold text-foreground truncate">
                {String(payerId)}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              aria-label="Copy customer number"
              onClick={async () => {
                const val = String(payerId);
                try {
                  await navigator.clipboard.writeText(val);
                  toast({ title: "Copied", description: `${val} copied to clipboard` });
                } catch {
                  toast({
                    title: "Copy failed",
                    description: "Could not access clipboard",
                    variant: "destructive",
                  });
                }
              }}
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        )}
        <div className="flex flex-col gap-1 mt-4">
          <MenuItem icon={<User className="w-4 h-4" />} label="Profile" onClick={onOpenProfile} />
          <MenuItem icon={<Settings className="w-4 h-4" />} label="Settings" onClick={onOpenSettings} />
          <MenuItem icon={<Shield className="w-4 h-4" />} label="Privacy & Security" onClick={onOpenPrivacy} />
          <MenuItem icon={<Share2 className="w-4 h-4" />} label="Social media" onClick={onOpenSocial} />
          <MenuItem icon={<HelpCircle className="w-4 h-4" />} label="Help" onClick={onOpenHelp} />
          <MenuItem
            icon={<Info className="w-4 h-4" />}
            label="About"
            onClick={() => setAboutOpen(true)}
          />
          <MenuItem
            icon={<LogOut className="w-4 h-4" />}
            label="Log out"
            onClick={onLogout}
            destructive
          />
        </div>
        <div className="mt-auto pt-4">
          <AppVersionInfo />
        </div>
      </SheetContent>
      <AboutModal open={aboutOpen} onOpenChange={setAboutOpen} />
    </Sheet>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm hover:bg-muted transition-colors ${
        destructive ? "text-destructive" : ""
      }`}
    >
      {icon}
      <span className="flex-1">{label}</span>
    </button>
  );
}
