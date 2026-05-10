
CREATE TABLE public.otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mobile text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  consumed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_otp_codes_mobile ON public.otp_codes(mobile, created_at DESC);
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;
-- No policies: only edge functions (service role) can access this table.
