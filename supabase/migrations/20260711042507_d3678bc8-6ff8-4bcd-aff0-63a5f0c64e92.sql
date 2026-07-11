DROP POLICY IF EXISTS "Users can read their own notifications" ON public.notification_inbox;
DROP POLICY IF EXISTS "Users can update read state on their own notifications" ON public.notification_inbox;

CREATE OR REPLACE FUNCTION public.current_user_mobile()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT split_part(email, '@', 1)
  FROM auth.users
  WHERE id = auth.uid()
$$;

CREATE POLICY "Users can read their own notifications"
ON public.notification_inbox
FOR SELECT
TO authenticated
USING (mobile = public.current_user_mobile());

CREATE POLICY "Users can update read state on their own notifications"
ON public.notification_inbox
FOR UPDATE
TO authenticated
USING (mobile = public.current_user_mobile())
WITH CHECK (mobile = public.current_user_mobile());