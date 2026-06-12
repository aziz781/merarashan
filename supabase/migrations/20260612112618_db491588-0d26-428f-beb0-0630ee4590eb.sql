CREATE TABLE public.native_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mobile text NOT NULL,
  fcm_token text NOT NULL UNIQUE,
  platform text NOT NULL DEFAULT 'android',
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.native_push_subscriptions TO service_role;
ALTER TABLE public.native_push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE INDEX native_push_mobile_idx ON public.native_push_subscriptions(mobile);