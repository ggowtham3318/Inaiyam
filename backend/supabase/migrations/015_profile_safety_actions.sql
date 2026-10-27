-- Keep auth user IDs out of the public profile payload while allowing members
-- to report or block a profile using its public profile ID.
create or replace function app.report_profile(
  p_profile_id uuid,
  p_category text,
  p_description text
)
returns app.reports
language plpgsql
security definer
set search_path = app, pg_temp
as $$
declare
  v_target_user_id uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;
  if not exists (select 1 from app.profiles where user_id = auth.uid() and status = 'approved' and deleted_at is null) then
    raise exception 'APPROVED_PROFILE_REQUIRED' using errcode = 'P0001';
  end if;
  select user_id into v_target_user_id
  from app.profiles
  where id = p_profile_id and status = 'approved' and deleted_at is null;
  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0001';
  end if;
  return app.report_user(v_target_user_id, p_category, p_description);
end;
$$;

create or replace function app.block_profile(
  p_profile_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = app, pg_temp
as $$
declare
  v_target_user_id uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;
  if not exists (select 1 from app.profiles where user_id = auth.uid() and status = 'approved' and deleted_at is null) then
    raise exception 'APPROVED_PROFILE_REQUIRED' using errcode = 'P0001';
  end if;
  select user_id into v_target_user_id
  from app.profiles
  where id = p_profile_id and status = 'approved' and deleted_at is null;
  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0001';
  end if;
  perform app.block_user(v_target_user_id, p_reason);
end;
$$;

revoke all on function app.report_profile(uuid, text, text) from public, anon;
revoke all on function app.block_profile(uuid, text) from public, anon;
grant execute on function app.report_profile(uuid, text, text) to authenticated;
grant execute on function app.block_profile(uuid, text) to authenticated;
alter function app.report_profile(uuid, text, text) set search_path = app, pg_temp;
alter function app.block_profile(uuid, text) set search_path = app, pg_temp;
