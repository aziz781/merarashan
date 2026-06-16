import { MessageCircle, Copy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

export function WhatsAppTile({
  href,
  number,
  title,
  subtitle,
}: {
  href: string;
  number: string;
  title: string;
  subtitle: string;
}) {
  const formatted = `+${number.slice(0, 2)} ${number.slice(2, 5)} ${number.slice(5, 8)} ${number.slice(8)}`;
  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(number);
      toast({ title: "Copied", description: `${formatted} copied to clipboard` });
    } catch {
      toast({ title: "Copy failed", description: "Could not access clipboard", variant: "destructive" });
    }
  };
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="block">
      <Card className="p-4 bg-[#25D366]/10 border-[#25D366]/30 shadow-[var(--shadow-soft)] cursor-pointer transition-transform hover:scale-[1.01] active:scale-[0.99]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center shrink-0">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground truncate">{title}</p>
            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
            <p className="text-xs text-foreground/80 font-mono truncate">{formatted}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            className="shrink-0 h-8 w-8 hover:bg-[#25D366]/20"
            aria-label={`Copy ${title} number`}
          >
            <Copy className="w-4 h-4" />
          </Button>
        </div>
      </Card>
    </a>
  );
}
