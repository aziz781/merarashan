import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
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
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export function DeleteAccountSection({ mobile }: { mobile: string }) {
  const [open, setOpen] = useState(false);
  const [customerNumber, setCustomerNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const CUSTOMER_NUMBER_REGEX = /^PYR[A-Z0-9]+$/;
  const trimmed = customerNumber.trim().toUpperCase();
  const isValidCustomerNumber = CUSTOMER_NUMBER_REGEX.test(trimmed);

  const handleDelete = async () => {
    if (!isValidCustomerNumber) {
      toast({
        title: "Invalid customer number",
        description: "Customer number must start with 'PYR' (e.g. PYR12345).",
        variant: "destructive",
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
      toast({ title: "Account deleted", description: "Signing you out…" });
      setOpen(false);
      await supabase.auth.signOut();
      window.location.reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to delete account";
      toast({ title: "Delete failed", description: msg, variant: "destructive" });
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
          <p className="font-medium mb-1">
            If you would still like to delete your account, please make sure:
          </p>
          <ol className="list-decimal pl-5 space-y-0.5 text-sm">
            <li>All Rashan transactions are complete</li>
            <li>Your account balance is zero</li>
          </ol>
        </AlertDescription>
      </Alert>

      <Button variant="destructive" onClick={() => setOpen(true)} className="w-full">
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
              placeholder="e.g. 12345"
              autoComplete="off"
              disabled={submitting}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={submitting || !customerNumber.trim()}
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
