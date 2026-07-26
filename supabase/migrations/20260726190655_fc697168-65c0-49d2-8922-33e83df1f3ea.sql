CREATE TABLE public.app_version_config (
  platform text PRIMARY KEY CHECK (platform IN ('android','ios','web')),
  min_supported_version_code int NOT NULL,
  latest_version_code int NOT NULL,
  latest_version_name text NOT NULL,
  store_url text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_version_config TO anon, authenticated;
GRANT ALL ON public.app_version_config TO service_role;

ALTER TABLE public.app_version_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read version config"
  ON public.app_version_config
  FOR SELECT
  USING (true);

CREATE TRIGGER update_app_version_config_updated_at
  BEFORE UPDATE ON public.app_version_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_notification_inbox_updated_at();