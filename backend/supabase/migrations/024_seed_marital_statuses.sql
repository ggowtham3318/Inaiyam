-- Seed the choices used by the hosted profile form. seed.sql is only run by local resets.
insert into app.lookup_marital_statuses (code, name, is_active)
values
  ('never_married', 'Single', true),
  ('divorced', 'Divorced', true),
  ('separated', 'Separated', true),
  ('widowed', 'Widowed', true)
on conflict (code) do update
set name = excluded.name,
    is_active = true;
