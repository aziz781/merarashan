ALTER TABLE public.notification_inbox ADD COLUMN read_at timestamp with time zone;
CREATE INDEX IF NOT EXISTS notification_inbox_mobile_read_at_idx ON public.notification_inbox (mobile, read_at);