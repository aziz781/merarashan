CREATE TABLE public.otp_bypass_mobiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mobile text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.otp_bypass_mobiles TO service_role;

ALTER TABLE public.otp_bypass_mobiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny anon and authenticated"
  ON public.otp_bypass_mobiles
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Service role full access"
  ON public.otp_bypass_mobiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_otp_bypass_mobiles_updated_at
  BEFORE UPDATE ON public.otp_bypass_mobiles
  FOR EACH ROW EXECUTE FUNCTION public.update_notification_inbox_updated_at();

INSERT INTO public.otp_bypass_mobiles (mobile, note) VALUES
  ('447525776781', 'Test account'),
  ('447548989200', 'Test account')
ON CONFLICT (mobile) DO NOTHING;