import { Sparkles, MessageSquare, History } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue: () => void;
}

/**
 * First-run onboarding for the AI Assistant. Explains what the assistant
 * can do and where past chats live. Shown once per device — the caller
 * persists a "seen" flag in localStorage.
 */
export function AssistantOnboardingDialog({ open, onOpenChange, onContinue }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center">Meet your AI Assistant</DialogTitle>
          <DialogDescription className="text-center">
            Ask questions about your rashans, statements, and cards in plain English or Urdu.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-3 text-sm">
          <li className="flex gap-3">
            <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              Try questions like <em>"How much did I spend this month?"</em> or
              {" "}<em>"Show my last 3 rashans."</em>
            </span>
          </li>
          <li className="flex gap-3">
            <History className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              Your conversation is saved on this device. Open the assistant
              anytime to continue — or tap the trash icon to clear it.
            </span>
          </li>
        </ul>

        <DialogFooter className="mt-2 sm:justify-center">
          <Button type="button" onClick={onContinue} className="w-full sm:w-auto">
            Get started
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
