REVOKE EXECUTE ON FUNCTION public.update_support_updated_at() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_support_updated_at() FROM anon;
GRANT EXECUTE ON FUNCTION public.update_support_updated_at() TO service_role;