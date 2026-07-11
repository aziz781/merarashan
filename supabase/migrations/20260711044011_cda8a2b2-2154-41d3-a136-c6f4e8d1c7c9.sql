GRANT DELETE ON public.notification_inbox TO authenticated;

CREATE POLICY "Users can delete their own notifications"
ON public.notification_inbox
FOR DELETE
TO authenticated
USING (mobile = public.current_user_mobile());