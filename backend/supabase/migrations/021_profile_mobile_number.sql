alter table app.profiles
  add column mobile_number text
  check (mobile_number is null or mobile_number ~ '^\+91[6-9][0-9]{9}$');

grant update (mobile_number) on app.profiles to authenticated;
