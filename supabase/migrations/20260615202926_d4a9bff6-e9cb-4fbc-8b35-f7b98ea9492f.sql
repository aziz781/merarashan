DROP POLICY IF EXISTS "Users can view their own notification inbox" ON public.notification_inbox;
REVOKE SELECT ON public.notification_inbox FROM authenticated;