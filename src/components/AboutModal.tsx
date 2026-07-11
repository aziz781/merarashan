import { ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AppVersionInfo } from "@/components/AppVersionInfo";
import meraRashanLogo from "@/assets/mera-rashan-logo.webp";

interface AboutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AboutModal({ open, onOpenChange }: AboutModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-muted/50">
            <img
              src={meraRashanLogo}
              alt="Mera Rashan logo"
              className="h-16 w-16 object-contain"
            />
          </div>
          <DialogTitle>About Mera Rashan</DialogTitle>
          <DialogDescription>
            Track your rashan card, subsidies, and transactions in one secure place.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground text-center leading-relaxed">
            Mera Rashan helps Pakistani families view their registered rashan cards,
            track monthly entitlements, review transactions, download statements, and receive
            instant notifications — all from a simple, mobile-first experience.
          </p>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => window.open("https://merarashan.pk", "_blank", "noopener,noreferrer")}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Visit merarashan.pk
          </Button>

          <div className="pt-2 border-t border-border">
            <AppVersionInfo />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
