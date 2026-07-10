import { useState } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { supabase } from "@/integrations/supabase/client";
import { clearAllAppCache } from "@/lib/api";

export function DeleteAccountSection({
  mobile,
  expectedCustomerNumber,
  onDeleted,
}: {
  mobile: string;
  expectedCustomerNumber?: string;
  onDeleted?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [customerNumber, setCustomerNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);


  const CUSTOMER_NUMBER_REGEX = /^PYR[A-Z0-9]+$/;
  const trimmed = customerNumber.trim().toUpperCase();
  const expected = (expectedCustomerNumber ?? "").trim().toUpperCase();
  const matchesProfile = expected.length > 0 && trimmed === expected;
  const isValidCustomerNumber =
    CUSTOMER_NUMBER_REGEX.test(trimmed) && matchesProfile;

  const handleDelete = async () => {
    if (!CUSTOMER_NUMBER_REGEX.test(trimmed)) {
      toast.error("Invalid customer number", {
        description: "Customer number must start with 'PYR' (e.g. PYR12345).",
      });
      return;
    }
    if (!matchesProfile) {
      toast.error("Customer number doesn't match", {
        description: "Enter the customer ID shown on your profile.",
      });
      return;
    }
    setSubmitting(true);
    try {
      const url = new URL(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/merarashan-proxy`,
      );
      url.searchParams.set("resource", "customers");
      url.searchParams.set("mobile", mobile);
      url.searchParams.set("customerNumber", trimmed);
      url.searchParams.set("action", "delete-account");
      const res = await fetch(url.toString(), {
        method: "DELETE",
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Request failed (${res.status}): ${txt}`);
      }
      toast.success("Account deleted successfully", {
        description: "You will be redirected to the login screen.",
      });
      clearAllAppCache();
      setOpen(false);
      await supabase.auth.signOut();
      onDeleted?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to delete account";
      toast.error("Delete failed", { description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="p-4 bg-card/80 backdrop-blur shadow-[var(--shadow-soft)] border-border/50 space-y-3">
      <h3 className="text-base font-bold text-foreground">Delete account</h3>
      <p className="text-sm text-muted-foreground">
        Deleting your account is{" "}
        <em className="font-semibold text-foreground">permanent and can not be undone</em>.
        It's free to keep it open.
      </p>

      <Alert variant="destructive" className="border-amber-500/50 text-amber-900 dark:text-amber-200 [&>svg]:text-amber-600">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <p className="font-medium mb-2">
            If you would still like to delete your account, then:
          </p>
          <ul className="space-y-1.5 text-sm text-left">
            <li className="flex items-start gap-2">
              <X className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <span>Your Mera Rashan Cards will not work.</span>
            </li>
            <li className="flex items-start gap-2">
              <X className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <span>Rashan Codes cannot be generated.</span>
            </li>
            <li className="flex items-start gap-2">
              <X className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <span>You can't log in to the app.</span>
            </li>
            <li className="flex items-start gap-2">
              <X className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <span>You can't restore the access.</span>
            </li>
          </ul>
        </AlertDescription>
      </Alert>

      <label className="flex items-start gap-2 text-sm text-muted-foreground cursor-pointer">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-input text-primary focus:ring-primary accent-primary"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        <span>I understand and want to delete my account.</span>
      </label>

      <Button variant="destructive" onClick={() => setOpen(true)} className="w-full" disabled={!confirmed}>
        Delete account
      </Button>

      <AlertDialog open={open} onOpenChange={(o) => !submitting && setOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm account deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Enter your customer number to permanently delete your account. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="customer-number">Customer number</Label>
            <Input
              id="customer-number"
              value={customerNumber}
              onChange={(e) => setCustomerNumber(e.target.value)}
              placeholder="e.g. PYR12345"
              autoComplete="off"
              disabled={submitting}
              aria-invalid={customerNumber.length > 0 && !isValidCustomerNumber}
            />
            {customerNumber.length > 0 && !CUSTOMER_NUMBER_REGEX.test(trimmed) ? (
              <p className="text-xs text-destructive">
                Customer number must start with "PYR".
              </p>
            ) : customerNumber.length > 0 && !matchesProfile ? (
              <p className="text-xs text-destructive">
                Customer number doesn't match your profile.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Enter the customer ID shown on your profile (starts with "PYR").
              </p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={submitting || !isValidCustomerNumber}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Deleting…
                </>
              ) : (
                "Delete account"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
