-- Migration: add_superadmin_and_owner_roles
-- Adds the superadmin and owner roles, their permissions,
-- and assigns both to admin@zenpire.eu.

-- 1. New roles
INSERT INTO public.role (code, name)
VALUES
  ('superadmin', 'Superadmin'),
  ('owner',      'Owner')
ON CONFLICT (code) DO NOTHING;

-- 2. New permissions
INSERT INTO public.permission (code, description)
VALUES
  ('superadmin',    'Access to superadmin features — manage all clients'),
  ('store.manage',  'Create / edit / delete stores for this client')
ON CONFLICT (code) DO NOTHING;

-- 3. superadmin role → superadmin permission
INSERT INTO public.role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM   public.role r, public.permission p
WHERE  r.code = 'superadmin' AND p.code = 'superadmin'
ON CONFLICT DO NOTHING;

-- 4. owner role → all admin-level permissions + store.manage
INSERT INTO public.role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM   public.role r, public.permission p
WHERE  r.code = 'owner'
  AND  p.code IN (
    'admin', 'admin.export',
    'recipe.manage', 'recipe.read',
    'unit.manage', 'unit.read',
    'store.manage'
  )
ON CONFLICT DO NOTHING;

-- 5. Assign superadmin + owner roles to admin@zenpire.eu
INSERT INTO public.user_role (user_id, role_id)
SELECT au.id, r.id
FROM   public.app_user au, public.role r
WHERE  au.email = 'admin@zenpire.eu'
  AND  r.code IN ('superadmin', 'owner')
ON CONFLICT DO NOTHING;
