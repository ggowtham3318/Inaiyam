select id, email
from auth.users
where email = 'testadmin@example.com';

insert into app.user_roles(user_id, role)
values ('039697ae-283e-474b-bfe2-03065fe9d9dc', 'admin')
on conflict do nothing;

select
  u.email,
  ur.user_id,
  ur.role
from auth.users u
join app.user_roles ur on ur.user_id = u.id
where u.email = 'testadmin@example.com';