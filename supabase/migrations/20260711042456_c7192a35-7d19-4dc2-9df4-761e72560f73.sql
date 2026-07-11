GRANT SELECT ON public.notification_inbox TO authenticated;

CREATE POLICY "Users can read their own notifications"
ON public.notification_inbox
FOR SELECT
TO authenticated
USING (
  mobile = (auth.jwt() -> 'user_metadata' ->> 'mobile')
);

CREATE POLICY "Users can update read state on their own notifications"
ON public.notification_inbox
FOR UPDATE
TO authenticated
USING (
  mobile = (auth.jwt() -> 'user_metadata' ->> 'mobile')
)
WITH CHECK (
  mobile = (auth.jwt() -> 'user_metadata' ->> 'mobile')
);

GRANT UPDATE ON public.notification_inbox TO authenticated;