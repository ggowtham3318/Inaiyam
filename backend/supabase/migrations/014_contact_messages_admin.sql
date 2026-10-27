-- Enable the public contact form and staff handling workflow.
-- RLS remains the row-level boundary: anon can only insert, and staff can read/update.
alter table app.contact_messages
  add column if not exists handled_at timestamptz,
  add column if not exists handled_by uuid references auth.users(id);

grant insert on app.contact_messages to anon, authenticated;
grant select, update on app.contact_messages to authenticated;

create policy contact_messages_staff_update on app.contact_messages
for update to authenticated
using (app.is_staff())
with check (app.is_staff());
