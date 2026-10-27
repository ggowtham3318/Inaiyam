select id, email
from auth.users
where email = 'test1-admin@example.com';

insert into app.user_roles(user_id, role)
values ('20df4b07-7e9b-4f0b-b3ec-9db9bbac4909', 'admin')
on conflict do nothing;

select
  ur.user_id,
  ur.role,
  u.email
from app.user_roles ur
join auth.users u on u.id = ur.user_id
where u.email = 'test1-admin@example.com';