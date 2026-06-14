import { useNavigate } from "react-router-dom";
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
import { openAppLink } from "@/lib/openAppLink";

export type PushNotificationPayload = {
  title?: string;
  body?: string;
  url?: string;
};

export function PushNotificationDialog({
  notification,
  onClose,
}: {
  notification: PushNotificationPayload | null;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const open = !!notification;

  const handleOpen = () => {
    const url = notification?.url;
    onClose();
    openAppLink(url, navigate);
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{notification?.title || "Notification"}</AlertDialogTitle>
          {notification?.body && (
            <AlertDialogDescription className="whitespace-pre-wrap">
              {notification.body}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Dismiss</AlertDialogCancel>
          {notification?.url && (
            <AlertDialogAction onClick={handleOpen}>Open</AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
