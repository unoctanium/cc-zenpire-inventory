-- A user may hold multiple roles whose permission sets overlap.
-- Add DISTINCT so each permission_code appears at most once per user.
CREATE OR REPLACE VIEW public.v_user_permissions AS
SELECT DISTINCT
  au.id          AS app_user_id,
  au.auth_user_id,
  p.code         AS permission_code
FROM public.app_user au
JOIN public.user_role      ur ON ur.user_id  = au.id
JOIN public.role_permission rp ON rp.role_id  = ur.role_id
JOIN public.permission      p  ON p.id        = rp.permission_id;
