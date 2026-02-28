-- Add admin.export permission and attach to admin role.
-- This permission gates the DB export endpoint (and future import endpoint).
-- It is separate from the 'admin' permission so it can be granted independently.

INSERT INTO public.permission (code, description)
VALUES ('admin.export', 'Export and import all business data')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM public.role r
JOIN public.permission p ON p.code = 'admin.export'
WHERE r.code = 'admin'
ON CONFLICT DO NOTHING;
