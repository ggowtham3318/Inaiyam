alter table app.profiles
  add column full_address text
  check (full_address is null or char_length(full_address) <= 1000);

grant update (full_address) on app.profiles to authenticated;
