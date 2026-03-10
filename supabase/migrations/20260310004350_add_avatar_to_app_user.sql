-- Add avatar storage to app_user (base64-encoded binary + mime type)
ALTER TABLE public.app_user
  ADD COLUMN IF NOT EXISTS avatar_data text,
  ADD COLUMN IF NOT EXISTS avatar_mime text;
