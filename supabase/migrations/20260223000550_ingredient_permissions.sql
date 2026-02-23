-- supabase/migrations/20260223000001_ingredient_permissions.sql

INSERT INTO public.permission (code, description)
VALUES
  ('ingredient.manage', 'Manage ingredients'),
  ('ingredient.read',   'Read-only access to ingredients')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM public.role r
JOIN public.permission p ON p.code = 'ingredient.manage'
WHERE r.code = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM public.role r
JOIN public.permission p ON p.code = 'ingredient.read'
WHERE r.code = 'viewer'
ON CONFLICT DO NOTHING;
