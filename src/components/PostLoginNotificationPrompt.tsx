import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { isNativePlatform, getNativeNotificationPermission, enableNativePush } from "@/lib/nativePush";
import { pushSupported, getCurrentSubscription, enablePush } from "@/lib/push";

const DISMISSED_KEY = "mr_post_login_prompt_dismissed";

export function PostLoginNotificationPrompt({
  mobile,
  open,
  onClose,
}: {
  mobile: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!open || !mobile) {
      setVisible(false);
      return;
    }

    try {
      if (sessionStorage.getItem(DISMISSED_KEY) === "1") {
        onClose();
        return;
      }
    } catch { /* ignore */ }

    let cancelled = false;
    const check = async () => {
      try {
        if (isNativePlatform()) {
          const status = await getNativeNotificationPermission();
          if (!cancelled) {
            if (status === "granted" || status === "denied" || status === "unknown") {
              onClose();
            } else {
              setVisible(true);
            }
          }
          return;
        }

        if (!pushSupported()) {
          if (!cancelled) onClose();
          return;
        }
        const sub = await getCurrentSubscription();
        if (!cancelled) {
          if (Notification.permission === "granted" || Notification.permission === "denied") {
            onClose();
          } else {
            setVisible(true);
          }
        }
      } catch {
        if (!cancelled) onClose();
      }
    };

    // Brief delay so the login toast and route transition finish before the prompt appears.
    const timer = window.setTimeout(() => void check(), 600);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, mobile, onClose]);

  const handleEnable = async () => {
    if (!mobile) return;
    try {
      if (isNativePlatform()) {
        await enableNativePush(mobile);
      } else {
        await enablePush(mobile);
      }
      toast.success("Notifications enabled", {
        description: "You'll receive alerts on this device.",
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not enable notifications");
    } finally {
      setVisible(false);
      onClose();
    }
  };

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(DISMISSED_KEY, "1");
    } catch { /* ignore */ }
    setVisible(false);
    onClose();
  };

  return (
    <AlertDialog open={visible} onOpenChange={(v) => { if (!v) handleDismiss(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Bell className="h-6 w-6 text-primary" />
          </div>
          <AlertDialogTitle className="text-center">Stay updated</AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            Get notified when your monthly rashan is issued, statements are ready, and for important account updates.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel onClick={handleDismiss} className="w-full sm:w-auto">
            Not now
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleEnable}
            className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Enable notifications
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
