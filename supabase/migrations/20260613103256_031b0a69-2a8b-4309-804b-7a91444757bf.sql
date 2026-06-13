CREATE TABLE public.notification_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mobile text NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  url text,
  tag text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.notification_inbox TO authenticated;
GRANT ALL ON public.notification_inbox TO service_role;

ALTER TABLE public.notification_inbox ENABLE ROW LEVEL SECURITY;

CREATE INDEX notification_inbox_mobile_created_idx
  ON public.notification_inbox (mobile, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_notification_inbox_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_notification_inbox_updated_at
BEFORE UPDATE ON public.notification_inbox
FOR EACH ROW
EXECUTE FUNCTION public.update_notification_inbox_updated_at();

CREATE POLICY "Users can view their own notification inbox"
ON public.notification_inbox
FOR SELECT
TO authenticated
USING (
  mobile = COALESCE(
    auth.jwt() -> 'user_metadata' ->> 'mobile',
    split_part(auth.jwt() ->> 'email', '@', 1)
  )
);

CREATE POLICY "Service role can manage notification inbox"
ON public.notification_inbox
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);