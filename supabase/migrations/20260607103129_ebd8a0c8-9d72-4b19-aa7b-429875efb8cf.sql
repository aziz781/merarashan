REVOKE ALL ON public.push_subscriptions FROM anon, authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

DROP POLICY IF EXISTS "Service role full access" ON public.push_subscriptions;
CREATE POLICY "Service role full access"
ON public.push_subscriptions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);