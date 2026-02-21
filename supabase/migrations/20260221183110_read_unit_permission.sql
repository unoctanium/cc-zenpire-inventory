insert into permission (code, description)
values ('unit.read', 'Read-only access to units')
on conflict (code) do nothing;

insert into role (code, name)
values ('viewer', 'Read-only role')
on conflict (code) do nothing;

insert into role_permission (role_id, permission_id)
select r.id, p.id
from role r
join permission p on p.code = 'unit.read'
where r.code = 'viewer'
on conflict do nothing;

