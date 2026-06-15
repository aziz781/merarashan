CREATE INDEX IF NOT EXISTS idx_notification_inbox_mobile_created
  ON public.notification_inbox (mobile, created_at DESC);