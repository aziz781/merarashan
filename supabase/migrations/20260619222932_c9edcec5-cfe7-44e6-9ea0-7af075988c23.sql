GRANT SELECT ON public.notification_inbox TO authenticated;

CREATE POLICY "Users can view their own notifications"
ON public.notification_inbox
FOR SELECT
TO authenticated
USING (
  mobile = COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'mobile'),
    (auth.jwt() ->> 'phone')
  )
);