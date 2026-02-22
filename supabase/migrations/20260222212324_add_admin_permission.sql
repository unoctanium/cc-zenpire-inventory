-- Add 'admin' permission and attach to existing 'admin' role
INSERT INTO public.permission (code, description)
VALUES ('admin', 'Full admin access including dev tools')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM public.role r
JOIN public.permission p ON p.code = 'admin'
WHERE r.code = 'admin'
ON CONFLICT DO NOTHING;
