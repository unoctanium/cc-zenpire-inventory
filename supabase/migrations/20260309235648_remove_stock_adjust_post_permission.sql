-- stock.adjust.post is a leftover from the dropped stock tables — remove it.
DELETE FROM public.role_permission
WHERE permission_id = (SELECT id FROM public.permission WHERE code = 'stock.adjust.post');

DELETE FROM public.permission WHERE code = 'stock.adjust.post';
