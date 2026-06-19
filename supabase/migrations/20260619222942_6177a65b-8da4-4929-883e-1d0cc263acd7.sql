DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notification_inbox;

CREATE POLICY "Users can view their own notifications"
ON public.notification_inbox
FOR SELECT
TO authenticated
USING (
  mobile = split_part((auth.jwt() ->> 'email'), '@', 1)
);