-- Authenticated users may read only their own role.
-- Role writes remain service-role-only.
alter table app.user_roles enable row level security;
grant select on app.user_roles to authenticated;

drop policy if exists user_roles_self_read on app.user_roles;
create policy user_roles_self_read
  on app.user_roles
  for select
  to authenticated
  using (user_id = (select auth.uid()));
