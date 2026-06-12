
-- Ensure RLS is enabled
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.native_push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Add missing service-role policy on native_push_subscriptions
DROP POLICY IF EXISTS "Service role full access" ON public.native_push_subscriptions;
CREATE POLICY "Service role full access"
  ON public.native_push_subscriptions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Revoke Data API access from anon/authenticated; only service_role should reach these
REVOKE ALL ON public.otp_codes FROM anon, authenticated, PUBLIC;
REVOKE ALL ON public.push_subscriptions FROM anon, authenticated, PUBLIC;
REVOKE ALL ON public.native_push_subscriptions FROM anon, authenticated, PUBLIC;

GRANT ALL ON public.otp_codes TO service_role;
GRANT ALL ON public.push_subscriptions TO service_role;
GRANT ALL ON public.native_push_subscriptions TO service_role;

-- Defense in depth: explicit restrictive policies denying anon/authenticated
CREATE POLICY "Deny anon and authenticated"
  ON public.otp_codes
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Deny anon and authenticated"
  ON public.push_subscriptions
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Deny anon and authenticated"
  ON public.native_push_subscriptions
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
