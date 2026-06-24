import type { ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowLeft } from "lucide-react";
import { useSwipeToClose } from "@/hooks/use-swipe-to-close";

interface SlideInPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}

/**
 * Right-side slide-in panel used for Profile / Help / Settings.
 * Handles swipe-right-to-close, a back button, and the dialog chrome.
 */
export function SlideInPanel({
  open,
  onOpenChange,
  title,
  description,
  children,
}: SlideInPanelProps) {
  const swipe = useSwipeToClose({
    direction: "right",
    onClose: () => onOpenChange(false),
  });

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          onInteractOutside={(e) => e.preventDefault()}
          {...swipe}
          style={{
            paddingTop: "max(1.5rem, env(safe-area-inset-top))",
            paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
            paddingLeft: "max(1.5rem, env(safe-area-inset-left))",
            paddingRight: "max(1.5rem, env(safe-area-inset-right))",
          }}
          className="fixed inset-y-0 right-0 z-50 h-full w-full sm:max-w-md border-l bg-background shadow-lg overflow-y-auto data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right data-[state=closed]:duration-300 data-[state=open]:duration-500"
        >
          <div className="mb-2">
            <DialogPrimitive.Close
              className="-ml-2 inline-flex items-center justify-center rounded-md p-2 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </DialogPrimitive.Close>
            <div className="h-6" aria-hidden />
            <DialogPrimitive.Title className="text-lg font-semibold text-foreground">
              {title}
            </DialogPrimitive.Title>
            {description && (
              <p className="mt-2 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          <div className="pt-2">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
