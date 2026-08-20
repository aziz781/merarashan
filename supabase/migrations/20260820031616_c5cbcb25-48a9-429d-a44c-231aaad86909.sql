ALTER TABLE public.support_messages
  ADD COLUMN IF NOT EXISTS attachment_path text,
  ADD COLUMN IF NOT EXISTS attachment_name text,
  ADD COLUMN IF NOT EXISTS attachment_type text;

ALTER TABLE public.support_messages ALTER COLUMN content DROP NOT NULL;

DROP POLICY IF EXISTS "Users manage own support attachments" ON storage.objects;
CREATE POLICY "Users manage own support attachments"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'support-attachments' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'support-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);