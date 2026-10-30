-- Verification is temporarily non-blocking. Keep is_fully_verified() as the
-- established authorization hook so signed-in RPCs remain compatible.
create or replace function app.is_fully_verified()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null;
$$;

revoke all on function app.is_fully_verified() from public, anon;
grant execute on function app.is_fully_verified() to authenticated;
