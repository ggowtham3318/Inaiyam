-- Public aggregate only. This does not expose profile rows or change table policies.
create or replace function app.public_stats()
returns table (approved_profiles bigint)
language sql
security definer
set search_path = ''
as $$
  select count(*)::bigint
  from app.profiles
  where status = 'approved'
    and deleted_at is null;
$$;

revoke all on function app.public_stats() from public;
grant execute on function app.public_stats() to anon, authenticated;
