-- Simplify roles and permissions
--
-- Changes:
--   1. admin role  → gets recipe.read + store.manage (now has full access)
--   2. owner role  → deleted (admin supersedes it)
--   3. viewer role → renamed to 'user' / 'User'
--   4. admin@zenpire.eu → keep only admin + superadmin roles

-- 1. Add missing permissions to admin role
INSERT INTO public.role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM   public.role r, public.permission p
WHERE  r.code = 'admin'
  AND  p.code IN ('recipe.read', 'store.manage')
ON CONFLICT DO NOTHING;

-- 2. Delete owner role (cascades role_permission + user_role)
DELETE FROM public.role WHERE code = 'owner';

-- 3. Rename viewer → user
UPDATE public.role SET code = 'user', name = 'User' WHERE code = 'viewer';

-- 4. Strip redundant roles from admin@zenpire.eu (keep admin + superadmin only)
DELETE FROM public.user_role
WHERE user_id = (SELECT id FROM public.app_user WHERE email = 'admin@zenpire.eu')
  AND role_id NOT IN (
    SELECT id FROM public.role WHERE code IN ('admin', 'superadmin')
  );
