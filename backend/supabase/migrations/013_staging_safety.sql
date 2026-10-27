-- Staging-readiness hardening. Preserve migrations 001-012 and apply this forward-only.

-- New accounts must not receive fabricated demographic values.
alter table app.profiles
  alter column gender drop default,
  alter column gender drop not null;

-- Temporarily remove the legacy trigger while cleaning known placeholder rows;
-- the hardened guard is recreated below in this same migration.
drop trigger if exists profiles_moderation_guard on app.profiles;
update app.profiles
set date_of_birth = null,
    gender = null,
    status = case when status in ('approved', 'pending_review') then 'draft'::app.profile_status else status end,
    reviewed_at = case when status in ('approved', 'pending_review') then null else reviewed_at end,
    reviewed_by = case when status in ('approved', 'pending_review') then null else reviewed_by end,
    submitted_at = case when status in ('approved', 'pending_review') then null else submitted_at end
where date_of_birth = date '1900-01-01';

-- The broad table grant in migration 002 made the later column-level revokes
-- ineffective. Revoke it and grant only owner-editable profile columns.
revoke update on app.profiles from authenticated;
grant update (
  profile_for,
  gender,
  date_of_birth,
  marital_status_id,
  height_cm,
  weight_kg,
  body_type_id,
  complexion_id,
  physical_status,
  mother_tongue,
  religion_id,
  caste_id,
  sub_caste_id,
  kulam,
  gothram,
  diet_id,
  smoking,
  drinking,
  education_id,
  occupation_category_id,
  occupation,
  employer_type,
  annual_income_range,
  country,
  state,
  city,
  citizenship,
  about_me,
  family_details,
  display_name
) on app.profiles to authenticated;

drop policy if exists profiles_owner_update on app.profiles;
create policy profiles_owner_update on app.profiles
for update to authenticated
using (
  user_id = (select auth.uid())
  and status not in ('suspended', 'deleted')
  and deleted_at is null
)
with check (
  user_id = (select auth.uid())
  and status not in ('suspended', 'deleted')
  and deleted_at is null
);

-- Consent writes are performed by the auth.users trigger, not by the browser.
revoke insert, update, delete on app.consent_records from anon, authenticated;
drop policy if exists consent_owner_insert on app.consent_records;
drop policy if exists consent_owner_read on app.consent_records;
create policy consent_owner_read on app.consent_records
for select to authenticated using (user_id = (select auth.uid()));

-- Blocks are written through the audited, validated RPC only.
revoke insert, update, delete on app.blocks from anon, authenticated;
drop policy if exists blocks_owner on app.blocks;
create policy blocks_owner_read on app.blocks
for select to authenticated using (blocker_user_id = (select auth.uid()));

-- Security-definer transitions set this transaction-local flag only after
-- performing their own authorization checks. Client table updates cannot set it.
create or replace function app.guard_profile_moderation_fields()
returns trigger
language plpgsql
security definer
set search_path = app, pg_catalog, pg_temp
as $$
declare
  v_internal_transition boolean := coalesce(current_setting('app.profile_moderation_rpc', true), '') = 'on';
  v_is_staff boolean := coalesce(app.is_staff(), false);
  v_public_fields_changed boolean;
begin
  if coalesce(auth.role(), '') = 'service_role' or v_is_staff or v_internal_transition then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'draft'
       or new.reviewed_at is not null
       or new.reviewed_by is not null
       or new.rejection_reason is not null
       or new.deleted_at is not null
       or new.submitted_at is not null then
      raise exception 'PROFILE_REVIEW_FIELDS_FORBIDDEN' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if new.user_id is distinct from old.user_id
     or new.status is distinct from old.status
     or new.reviewed_at is distinct from old.reviewed_at
     or new.reviewed_by is distinct from old.reviewed_by
     or new.rejection_reason is distinct from old.rejection_reason
     or new.deleted_at is distinct from old.deleted_at
     or new.submitted_at is distinct from old.submitted_at then
    raise exception 'PROFILE_REVIEW_FIELDS_FORBIDDEN' using errcode = 'P0001';
  end if;

  if old.status in ('suspended', 'deleted') or old.deleted_at is not null then
    raise exception 'PROFILE_NOT_EDITABLE' using errcode = 'P0001';
  end if;

  v_public_fields_changed :=
    new.profile_for is distinct from old.profile_for
    or new.gender is distinct from old.gender
    or new.date_of_birth is distinct from old.date_of_birth
    or new.marital_status_id is distinct from old.marital_status_id
    or new.height_cm is distinct from old.height_cm
    or new.weight_kg is distinct from old.weight_kg
    or new.body_type_id is distinct from old.body_type_id
    or new.complexion_id is distinct from old.complexion_id
    or new.physical_status is distinct from old.physical_status
    or new.mother_tongue is distinct from old.mother_tongue
    or new.religion_id is distinct from old.religion_id
    or new.caste_id is distinct from old.caste_id
    or new.sub_caste_id is distinct from old.sub_caste_id
    or new.kulam is distinct from old.kulam
    or new.gothram is distinct from old.gothram
    or new.diet_id is distinct from old.diet_id
    or new.smoking is distinct from old.smoking
    or new.drinking is distinct from old.drinking
    or new.education_id is distinct from old.education_id
    or new.occupation_category_id is distinct from old.occupation_category_id
    or new.occupation is distinct from old.occupation
    or new.employer_type is distinct from old.employer_type
    or new.annual_income_range is distinct from old.annual_income_range
    or new.country is distinct from old.country
    or new.state is distinct from old.state
    or new.city is distinct from old.city
    or new.citizenship is distinct from old.citizenship
    or new.about_me is distinct from old.about_me
    or new.family_details is distinct from old.family_details
    or new.display_name is distinct from old.display_name;

  if v_public_fields_changed and old.status in ('approved', 'pending_review') then
    new.status := 'draft';
    new.reviewed_at := null;
    new.reviewed_by := null;
    new.rejection_reason := null;
    new.submitted_at := null;
  end if;

  return new;
end;
$$;

create trigger profiles_moderation_guard
before insert or update on app.profiles
for each row execute function app.guard_profile_moderation_fields();

-- The public view contains no auth user ID or contact fields. Append about_me
-- without changing the existing column order expected by generated RPC types.
create or replace view app.public_profiles
with (security_barrier = true)
as
select
  p.id,
  p.gender,
  extract(year from age(current_date, p.date_of_birth))::integer as age,
  p.profile_for,
  p.display_name,
  p.mother_tongue,
  p.religion_id,
  religion.name as religion_name,
  p.caste_id,
  caste.name as caste_name,
  p.marital_status_id,
  ms.name as marital_status_name,
  p.height_cm,
  p.state,
  p.city,
  p.education_id,
  e.name as education_name,
  p.occupation_category_id,
  oc.name as occupation_category_name,
  p.occupation,
  p.created_at,
  p.about_me
from app.profiles p
left join app.lookup_religions religion on religion.id = p.religion_id
left join app.lookup_castes caste on caste.id = p.caste_id
left join app.lookup_marital_statuses ms on ms.id = p.marital_status_id
left join app.lookup_education e on e.id = p.education_id
left join app.lookup_occupation_categories oc on oc.id = p.occupation_category_id
where p.status = 'approved' and p.deleted_at is null;

-- Replace the unbounded offset API with a bounded cursor API. Searches require
-- approved members, rate-limit requests and enforce both directions of blocks.
drop function if exists app.search_profiles(app.gender, integer, integer, uuid, uuid, text, text, uuid, integer, integer);
create or replace function app.search_profiles(
  p_gender app.gender default null,
  p_age_min integer default null,
  p_age_max integer default null,
  p_religion_id uuid default null,
  p_caste_id uuid default null,
  p_state text default null,
  p_city text default null,
  p_education_id uuid default null,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 20
) returns setof app.public_profiles
language plpgsql
security definer
set search_path = app, pg_temp
as $$
declare
  v_caller app.profiles;
  v_gender app.gender;
  v_rate app.search_rate_limits;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 50 then
    raise exception 'SEARCH_INVALID_LIMIT' using errcode = 'P0001';
  end if;
  if (p_cursor_created_at is null) <> (p_cursor_id is null) then
    raise exception 'SEARCH_INVALID_CURSOR' using errcode = 'P0001';
  end if;
  if (p_age_min is not null and (p_age_min < 18 or p_age_min > 100))
     or (p_age_max is not null and (p_age_max < 18 or p_age_max > 100))
     or (p_age_min is not null and p_age_max is not null and p_age_min > p_age_max) then
    raise exception 'SEARCH_INVALID_AGE' using errcode = 'P0001';
  end if;

  select * into v_caller
  from app.profiles
  where user_id = auth.uid() and status = 'approved' and deleted_at is null;
  if not found then
    raise exception 'APPROVED_PROFILE_REQUIRED' using errcode = 'P0001';
  end if;

  insert into app.search_rate_limits(user_id, window_started_at, request_count)
  values (auth.uid(), now(), 0)
  on conflict (user_id) do nothing;
  select * into v_rate from app.search_rate_limits where user_id = auth.uid() for update;
  if v_rate.window_started_at < now() - interval '1 minute' then
    update app.search_rate_limits
      set window_started_at = now(), request_count = 1
      where user_id = auth.uid();
  elsif v_rate.request_count >= 60 then
    raise exception 'SEARCH_RATE_LIMIT' using errcode = 'P0001';
  else
    update app.search_rate_limits
      set request_count = request_count + 1
      where user_id = auth.uid();
  end if;

  select case
    when v_caller.gender = 'male' then 'female'::app.gender
    when v_caller.gender = 'female' then 'male'::app.gender
    else null
  end into v_gender;

  return query
  select pp.*
  from app.public_profiles pp
  join app.profiles target on target.id = pp.id
  where target.user_id <> auth.uid()
    and (p_gender is not null and pp.gender = p_gender
      or p_gender is null and (v_gender is null or pp.gender = v_gender))
    and (p_age_min is null or pp.age >= p_age_min)
    and (p_age_max is null or pp.age <= p_age_max)
    and (p_religion_id is null or pp.religion_id = p_religion_id)
    and (p_caste_id is null or pp.caste_id = p_caste_id)
    and (p_state is null or lower(pp.state) = lower(p_state))
    and (p_city is null or lower(pp.city) = lower(p_city))
    and (p_education_id is null or pp.education_id = p_education_id)
    and (p_cursor_created_at is null or (pp.created_at, pp.id) < (p_cursor_created_at, p_cursor_id))
    and not exists (
      select 1 from app.blocks b
      where (b.blocker_user_id = auth.uid() and b.blocked_user_id = target.user_id)
         or (b.blocker_user_id = target.user_id and b.blocked_user_id = auth.uid())
    )
  order by pp.created_at desc, pp.id desc
  limit p_limit;
end;
$$;

-- Profile details are authenticated-member-only and concealed for blocked pairs.
create or replace function app.get_profile_detail(p_profile_id uuid)
returns app.public_profiles
language plpgsql
stable
security definer
set search_path = app, pg_temp
as $$
declare
  v_profile app.public_profiles;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from app.profiles
    where user_id = auth.uid() and status = 'approved' and deleted_at is null
  ) then
    raise exception 'APPROVED_PROFILE_REQUIRED' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from app.blocks b
    join app.profiles target on target.user_id = b.blocked_user_id
    where b.blocker_user_id = auth.uid() and target.id = p_profile_id
  ) or exists (
    select 1 from app.blocks b
    join app.profiles target on target.user_id = b.blocker_user_id
    where b.blocked_user_id = auth.uid() and target.id = p_profile_id
  ) then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0001';
  end if;
  select pp.* into v_profile
  from app.public_profiles pp
  where pp.id = p_profile_id;
  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0001';
  end if;
  return v_profile;
end;
$$;

-- Send-interest accepts a public profile ID, resolves the auth user server-side,
-- and restores block, message-length, daily-limit and notification checks.
drop function if exists app.send_interest(uuid, text);
create function app.send_interest(p_receiver_profile_id uuid, p_message text default null)
returns app.interests
language plpgsql
security definer
set search_path = app, pg_temp
as $$
declare
  v_interest app.interests;
  v_receiver_user_id uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;
  if p_message is not null and char_length(p_message) > 500 then
    raise exception 'INTEREST_MESSAGE_TOO_LONG' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from app.profiles
    where user_id = auth.uid() and status = 'approved' and deleted_at is null
  ) then
    raise exception 'APPROVED_PROFILE_REQUIRED' using errcode = 'P0001';
  end if;
  select user_id into v_receiver_user_id
  from app.profiles
  where id = p_receiver_profile_id and status = 'approved' and deleted_at is null;
  if not found then
    raise exception 'RECEIVER_PROFILE_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_receiver_user_id = auth.uid() then
    raise exception 'INTEREST_SELF' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from app.blocks
    where (blocker_user_id = auth.uid() and blocked_user_id = v_receiver_user_id)
       or (blocker_user_id = v_receiver_user_id and blocked_user_id = auth.uid())
  ) then
    raise exception 'INTEREST_BLOCKED' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext('interest:' || auth.uid()::text));
  if (select count(*) from app.interests where sender_user_id = auth.uid() and created_at >= current_date) >= 50 then
    raise exception 'INTEREST_DAILY_LIMIT' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from app.interests
    where sender_user_id = auth.uid() and receiver_user_id = v_receiver_user_id
      and status in ('pending', 'accepted')
  ) then
    raise exception 'INTEREST_ALREADY_EXISTS' using errcode = 'P0001';
  end if;

  insert into app.interests(sender_user_id, receiver_user_id, message)
  values (auth.uid(), v_receiver_user_id, nullif(trim(p_message), ''))
  returning * into v_interest;
  insert into app.notifications(user_id, notification_type, title, body, data)
  values (
    v_receiver_user_id,
    'interest_received',
    'New interest',
    'Someone sent you an interest.',
    jsonb_build_object('interest_id', v_interest.id)
  );
  return v_interest;
end;
$$;

create or replace function app.respond_interest(p_interest_id uuid, p_status app.interest_status)
returns app.interests
language plpgsql
security definer
set search_path = app, pg_temp
as $$
declare
  v_interest app.interests;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;
  if p_status not in ('accepted', 'declined') then
    raise exception 'INTEREST_INVALID_RESPONSE' using errcode = 'P0001';
  end if;
  select * into v_interest
  from app.interests
  where id = p_interest_id and receiver_user_id = auth.uid() and status = 'pending'
  for update;
  if not found then
    raise exception 'INTEREST_NOT_FOUND' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from app.blocks
    where (blocker_user_id = v_interest.sender_user_id and blocked_user_id = v_interest.receiver_user_id)
       or (blocker_user_id = v_interest.receiver_user_id and blocked_user_id = v_interest.sender_user_id)
  ) then
    raise exception 'INTEREST_BLOCKED' using errcode = 'P0001';
  end if;
  update app.interests
  set status = p_status, responded_at = now()
  where id = p_interest_id
  returning * into v_interest;
  insert into app.notifications(user_id, notification_type, title, body, data)
  values (
    v_interest.sender_user_id,
    'interest_response',
    'Interest updated',
    'Your interest received a response.',
    jsonb_build_object('interest_id', p_interest_id, 'status', p_status)
  );
  return v_interest;
end;
$$;

create or replace function app.withdraw_interest(p_interest_id uuid)
returns app.interests
language plpgsql
security definer
set search_path = app, pg_temp
as $$
declare
  v_interest app.interests;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;
  update app.interests
  set status = 'withdrawn'
  where id = p_interest_id and sender_user_id = auth.uid() and status in ('pending', 'accepted')
  returning * into v_interest;
  if not found then
    raise exception 'INTEREST_NOT_FOUND' using errcode = 'P0001';
  end if;
  return v_interest;
end;
$$;

create or replace function app.block_user(p_blocked_user_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = app, pg_temp
as $$
declare
  v_before jsonb;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;
  if p_blocked_user_id = auth.uid() then
    raise exception 'BLOCK_SELF' using errcode = 'P0001';
  end if;
  if not exists (select 1 from auth.users where id = p_blocked_user_id) then
    raise exception 'TARGET_USER_NOT_FOUND' using errcode = 'P0001';
  end if;
  if p_reason is not null and char_length(p_reason) > 1000 then
    raise exception 'BLOCK_REASON_TOO_LONG' using errcode = 'P0001';
  end if;
  v_before := jsonb_build_object('blocker_user_id', auth.uid(), 'blocked_user_id', p_blocked_user_id);
  insert into app.blocks(blocker_user_id, blocked_user_id, reason)
  values (auth.uid(), p_blocked_user_id, p_reason)
  on conflict do nothing;
  update app.interests
  set status = 'declined', responded_at = now()
  where ((sender_user_id = auth.uid() and receiver_user_id = p_blocked_user_id)
      or (sender_user_id = p_blocked_user_id and receiver_user_id = auth.uid()))
    and status in ('pending', 'accepted');
  perform app.write_audit('block_user', 'blocks', null, null, v_before, null);
end;
$$;

-- No staff bypass here: staff PII access uses the separately audited admin_get_contact RPC.
create or replace function app.get_contact_details(p_target_user_id uuid)
returns app.user_contact_details
language plpgsql
security definer
set search_path = app, pg_temp
as $$
declare
  v_contact app.user_contact_details;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;
  if p_target_user_id = auth.uid() then
    raise exception 'CONTACT_SELF' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from app.profiles
    where user_id = auth.uid() and status = 'approved' and deleted_at is null
  ) or not exists (
    select 1 from app.profiles
    where user_id = p_target_user_id and status = 'approved' and deleted_at is null
  ) then
    raise exception 'CONTACT_NOT_AVAILABLE' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from app.blocks
    where (blocker_user_id = auth.uid() and blocked_user_id = p_target_user_id)
       or (blocker_user_id = p_target_user_id and blocked_user_id = auth.uid())
  ) then
    raise exception 'CONTACT_NOT_AVAILABLE' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from app.interests i
    where i.status = 'accepted'
      and ((i.sender_user_id = auth.uid() and i.receiver_user_id = p_target_user_id)
        or (i.sender_user_id = p_target_user_id and i.receiver_user_id = auth.uid()))
  ) then
    raise exception 'CONTACT_NOT_AVAILABLE' using errcode = 'P0001';
  end if;
  select * into v_contact
  from app.user_contact_details
  where user_id = p_target_user_id;
  if not found then
    raise exception 'CONTACT_NOT_FOUND' using errcode = 'P0001';
  end if;
  return v_contact;
end;
$$;

drop policy if exists contacts_owner_read_self on app.user_contact_details;
create policy contacts_owner_read_self on app.user_contact_details
for select to authenticated
using (user_id = (select auth.uid()));

create or replace function app.add_profile_photo(
  p_profile_id uuid,
  p_storage_path text,
  p_is_primary boolean default false,
  p_is_blurred boolean default false,
  p_is_private boolean default false
)
returns app.profile_photos
language plpgsql
security definer
set search_path = app, pg_temp
as $$
declare
  v_photo app.profile_photos;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from app.profiles
    where id = p_profile_id and user_id = auth.uid()
      and status in ('draft', 'pending_review', 'approved') and deleted_at is null
  ) then
    raise exception 'PROFILE_NOT_UPLOADABLE' using errcode = 'P0001';
  end if;
  if p_storage_path is null or split_part(p_storage_path, '/', 1) <> auth.uid()::text then
    raise exception 'PHOTO_PATH_INVALID' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'photos-pending' and name = p_storage_path
  ) then
    raise exception 'PHOTO_OBJECT_NOT_FOUND' using errcode = 'P0001';
  end if;
  if (select count(*) from app.profile_photos
      where profile_id = p_profile_id and status in ('pending', 'approved')) >= 6 then
    raise exception 'PHOTO_LIMIT_REACHED' using errcode = 'P0001';
  end if;
  insert into app.profile_photos(
    profile_id, uploaded_by, storage_bucket, storage_path,
    is_primary, is_blurred, is_private
  ) values (
    p_profile_id, auth.uid(), 'photos-pending', p_storage_path,
    p_is_primary, p_is_blurred, p_is_private
  ) returning * into v_photo;
  return v_photo;
end;
$$;

-- Row removal and object removal use their separate authorized APIs. The client
-- deletes its own object through Storage RLS before invoking this metadata RPC.
create or replace function app.remove_profile_photo(p_photo_id uuid)
returns app.profile_photos
language plpgsql
security definer
set search_path = app, pg_temp
as $$
declare
  v_photo app.profile_photos;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;
  select ph.* into v_photo
  from app.profile_photos ph
  join app.profiles p on p.id = ph.profile_id
  where ph.id = p_photo_id and ph.uploaded_by = auth.uid() and p.user_id = auth.uid()
  for update;
  if not found then
    raise exception 'PHOTO_NOT_FOUND' using errcode = 'P0001';
  end if;
  delete from app.profile_photos where id = p_photo_id;
  perform app.write_audit(
    'remove_profile_photo',
    'profile_photos',
    p_photo_id,
    to_jsonb(v_photo),
    null,
    null
  );
  return v_photo;
end;
$$;

-- Owner can remove only files within their own UUID folder. All approved writes
-- remain staff-only; user uploads can never place an object in this bucket.
drop policy if exists approved_photo_owner_read on storage.objects;
create policy approved_photo_owner_read on storage.objects
for select to authenticated
using (
  bucket_id = 'photos-approved'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists approved_photo_owner_delete on storage.objects;
create policy approved_photo_owner_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'photos-approved'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Owners may see their own full photo moderation state; staff can review the queue.
drop policy if exists photos_owner_or_approved on app.profile_photos;
create policy photos_owner_or_approved on app.profile_photos
for select to authenticated
using (
  uploaded_by = (select auth.uid())
  or app.is_staff()
);

-- Storage previews are private and respect approval, membership and blocks.
create or replace function app.can_view_profile_photo(p_storage_path text)
returns boolean
language sql
stable
security definer
set search_path = app, pg_catalog, pg_temp
as $$
  select exists (
    select 1
    from app.profile_photos photo
    join app.profiles target on target.id = photo.profile_id
    where photo.storage_bucket = 'photos-approved'
      and photo.storage_path = p_storage_path
      and photo.status = 'approved'
      and target.status = 'approved'
      and target.deleted_at is null
      and (
        target.user_id = (select auth.uid())
        or app.is_staff()
        or (
          exists (
            select 1 from app.profiles viewer
            where viewer.user_id = (select auth.uid())
              and viewer.status = 'approved' and viewer.deleted_at is null
          )
          and not exists (
            select 1 from app.blocks b
            where (b.blocker_user_id = (select auth.uid()) and b.blocked_user_id = target.user_id)
               or (b.blocker_user_id = target.user_id and b.blocked_user_id = (select auth.uid()))
          )
        )
      )
  );
$$;
revoke all on function app.can_view_profile_photo(text) from public, anon;
grant execute on function app.can_view_profile_photo(text) to authenticated;

drop policy if exists photos_pending_owner_read on storage.objects;
create policy photos_pending_owner_read on storage.objects
for select to authenticated
using (
  bucket_id = 'photos-pending'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from app.profile_photos photo
    where photo.storage_bucket = 'photos-pending'
      and photo.storage_path = name
      and photo.uploaded_by = (select auth.uid())
      and photo.status = 'pending'
  )
);

drop policy if exists approved_photo_read on storage.objects;
create policy approved_photo_read on storage.objects
for select to authenticated
using (
  bucket_id = 'photos-approved'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or app.can_view_profile_photo(name)
  )
);

create or replace function app.admin_review_photo(
  p_photo_id uuid,
  p_status app.photo_status,
  p_reason text default null,
  p_approved_storage_path text default null
)
returns app.profile_photos
language plpgsql
security definer
set search_path = app, pg_temp
as $$
declare
  v_photo app.profile_photos;
  v_before jsonb;
begin
  if not app.is_staff() then
    raise exception 'STAFF_REQUIRED' using errcode = 'P0001';
  end if;
  if p_status not in ('approved', 'rejected') then
    raise exception 'PHOTO_INVALID_STATUS' using errcode = 'P0001';
  end if;
  if p_reason is not null and char_length(p_reason) > 1000 then
    raise exception 'PHOTO_REASON_TOO_LONG' using errcode = 'P0001';
  end if;
  select * into v_photo
  from app.profile_photos
  where id = p_photo_id
  for update;
  if not found then
    raise exception 'PHOTO_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_photo.status <> 'pending' or v_photo.storage_bucket <> 'photos-pending'
     or split_part(v_photo.storage_path, '/', 1) <> v_photo.uploaded_by::text then
    raise exception 'PHOTO_NOT_PENDING' using errcode = 'P0001';
  end if;
  v_before := to_jsonb(v_photo);

  if p_status = 'approved' then
    if p_approved_storage_path is distinct from (v_photo.uploaded_by::text || '/' || v_photo.id::text) then
      raise exception 'APPROVED_PATH_INVALID' using errcode = 'P0001';
    end if;
    if not exists (
      select 1 from storage.objects
      where bucket_id = 'photos-approved' and name = p_approved_storage_path
    ) then
      raise exception 'APPROVED_OBJECT_REQUIRED' using errcode = 'P0001';
    end if;
    update app.profile_photos
    set status = 'approved', storage_bucket = 'photos-approved',
        storage_path = p_approved_storage_path, reviewed_at = now(),
        reviewed_by = auth.uid(), rejection_reason = null
    where id = p_photo_id
    returning * into v_photo;
  else
    update app.profile_photos
    set status = 'rejected', reviewed_at = now(),
        reviewed_by = auth.uid(), rejection_reason = p_reason
    where id = p_photo_id
    returning * into v_photo;
  end if;

  perform app.write_audit(
    'review_photo', 'profile_photos', p_photo_id,
    v_before, to_jsonb(v_photo), null
  );
  return v_photo;
end;
$$;

create or replace function app.submit_profile_for_review(p_profile_id uuid)
returns app.profiles
language plpgsql
security definer
set search_path = app, pg_temp
as $$
declare
  v_profile app.profiles;
  v_before jsonb;
  v_preferences text;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;
  select * into v_profile
  from app.profiles
  where id = p_profile_id and user_id = auth.uid()
    and status in ('draft', 'rejected') and deleted_at is null
  for update;
  if not found then
    raise exception 'PROFILE_NOT_EDITABLE' using errcode = 'P0001';
  end if;
  select additional_preferences->>'description' into v_preferences
  from app.partner_preferences
  where profile_id = p_profile_id;
  if v_profile.display_name is null or char_length(trim(v_profile.display_name)) < 2
     or v_profile.date_of_birth is null
     or v_profile.date_of_birth > current_date - interval '18 years'
     or v_profile.date_of_birth < current_date - interval '101 years'
     or v_profile.gender is null
     or v_profile.marital_status_id is null
     or v_profile.city is null or char_length(trim(v_profile.city)) < 2
     or v_profile.state is null or char_length(trim(v_profile.state)) < 2
     or v_profile.country is null
     or v_profile.occupation is null or char_length(trim(v_profile.occupation)) < 2
     or v_profile.about_me is null or char_length(trim(v_profile.about_me)) < 30
     or v_preferences is null or char_length(trim(v_preferences)) < 10 then
    raise exception 'PROFILE_INCOMPLETE' using errcode = 'P0001';
  end if;

  v_before := jsonb_build_object('status', v_profile.status);
  perform set_config('app.profile_moderation_rpc', 'on', true);
  update app.profiles
  set status = 'pending_review', submitted_at = now(),
      reviewed_at = null, reviewed_by = null, rejection_reason = null
  where id = p_profile_id
  returning * into v_profile;
  perform app.write_audit(
    'submit_profile_for_review', 'profiles', p_profile_id,
    v_before, jsonb_build_object('status', v_profile.status), null
  );
  perform set_config('app.profile_moderation_rpc', 'off', true);
  return v_profile;
end;
$$;

create or replace function app.admin_set_profile_status(
  p_profile_id uuid,
  p_status app.profile_status,
  p_reason text default null
)
returns app.profiles
language plpgsql
security definer
set search_path = app, pg_temp
as $$
declare
  v_profile app.profiles;
  v_before jsonb;
begin
  if not app.is_staff() then
    raise exception 'STAFF_REQUIRED' using errcode = 'P0001';
  end if;
  if p_status not in ('approved', 'rejected', 'suspended', 'deleted') then
    raise exception 'PROFILE_INVALID_STATUS' using errcode = 'P0001';
  end if;
  if p_reason is not null and char_length(p_reason) > 1000 then
    raise exception 'PROFILE_REASON_TOO_LONG' using errcode = 'P0001';
  end if;
  select * into v_profile from app.profiles where id = p_profile_id for update;
  if not found or v_profile.status = 'deleted' then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0001';
  end if;
  if p_status = 'approved' and (
    v_profile.status <> 'pending_review'
    or v_profile.display_name is null or char_length(trim(v_profile.display_name)) < 2
    or v_profile.date_of_birth is null
    or v_profile.date_of_birth > current_date - interval '18 years'
    or v_profile.date_of_birth < current_date - interval '101 years'
    or v_profile.gender is null
    or v_profile.marital_status_id is null
    or v_profile.city is null or char_length(trim(v_profile.city)) < 2
    or v_profile.state is null or char_length(trim(v_profile.state)) < 2
    or v_profile.country is null
    or v_profile.occupation is null or char_length(trim(v_profile.occupation)) < 2
    or v_profile.about_me is null or char_length(trim(v_profile.about_me)) < 30
    or not exists (
      select 1 from app.partner_preferences pp
      where pp.profile_id = p_profile_id
        and char_length(trim(coalesce(pp.additional_preferences->>'description', ''))) >= 10
    )
  ) then
    raise exception 'PROFILE_INCOMPLETE' using errcode = 'P0001';
  end if;
  v_before := jsonb_build_object('status', v_profile.status, 'deleted_at', v_profile.deleted_at);
  perform set_config('app.profile_moderation_rpc', 'on', true);
  update app.profiles
  set status = p_status,
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      rejection_reason = case when p_status = 'rejected' then p_reason else null end,
      deleted_at = case when p_status = 'deleted' then now() else null end,
      submitted_at = case when p_status = 'pending_review' then now() else submitted_at end
  where id = p_profile_id
  returning * into v_profile;
  perform app.write_audit(
    'admin_set_profile_status', 'profiles', p_profile_id,
    v_before,
    jsonb_build_object('status', v_profile.status, 'deleted_at', v_profile.deleted_at, 'reason', p_reason),
    null
  );
  perform set_config('app.profile_moderation_rpc', 'off', true);
  return v_profile;
end;
$$;

-- Do not expose the legacy status writer; all staff state changes use the audited RPC.
revoke all on function app.admin_review_profile(uuid, app.profile_status, text) from public, anon, authenticated;

-- Revoke the old signature and grant only current, intended RPC entry points.
revoke all on function app.get_profile_detail(uuid) from public, anon;
revoke all on function app.search_profiles(app.gender, integer, integer, uuid, uuid, text, text, uuid, timestamptz, uuid, integer) from public, anon;
revoke all on function app.send_interest(uuid, text) from public, anon;
revoke all on function app.respond_interest(uuid, app.interest_status) from public, anon;
revoke all on function app.withdraw_interest(uuid) from public, anon;
revoke all on function app.block_user(uuid, text) from public, anon;
revoke all on function app.get_contact_details(uuid) from public, anon;
revoke all on function app.add_profile_photo(uuid, text, boolean, boolean, boolean) from public, anon;
revoke all on function app.remove_profile_photo(uuid) from public, anon;
revoke all on function app.admin_review_photo(uuid, app.photo_status, text, text) from public, anon;
revoke all on function app.admin_set_profile_status(uuid, app.profile_status, text) from public, anon;
revoke all on function app.admin_get_contact(uuid, text) from public, anon;

grant execute on function app.get_profile_detail(uuid) to authenticated;
grant execute on function app.search_profiles(app.gender, integer, integer, uuid, uuid, text, text, uuid, timestamptz, uuid, integer) to authenticated;
grant execute on function app.send_interest(uuid, text) to authenticated;
grant execute on function app.respond_interest(uuid, app.interest_status) to authenticated;
grant execute on function app.withdraw_interest(uuid) to authenticated;
grant execute on function app.block_user(uuid, text) to authenticated;
grant execute on function app.get_contact_details(uuid) to authenticated;
grant execute on function app.add_profile_photo(uuid, text, boolean, boolean, boolean) to authenticated;
grant execute on function app.remove_profile_photo(uuid) to authenticated;
grant execute on function app.admin_review_photo(uuid, app.photo_status, text, text) to authenticated;
grant execute on function app.admin_set_profile_status(uuid, app.profile_status, text) to authenticated;
grant execute on function app.admin_get_contact(uuid, text) to authenticated;

-- Consent is recorded by the auth.users trigger, never by accepting a client
-- supplied user_id in a direct table insert.
create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = app, pg_catalog, pg_temp
as $$
declare
  v_version text := new.raw_user_meta_data->>'policy_version';
begin
  if (new.raw_user_meta_data->>'privacy_policy_accepted') is distinct from 'true'
     or (new.raw_user_meta_data->>'terms_accepted') is distinct from 'true'
     or v_version is distinct from 'staging-v1' then
    raise exception 'CONSENT_REQUIRED' using errcode = 'P0001';
  end if;

  insert into app.profiles(user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', ''))
  on conflict (user_id) do nothing;

  insert into app.consent_records(user_id, consent_type, policy_version, granted)
  values
    (new.id, 'privacy_policy', v_version, true),
    (new.id, 'terms_of_service', v_version, true);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function app.handle_new_user();

-- RLS catalog assertion can be run by the local/test service role only.
revoke all on function app.assert_all_tables_rls() from public, anon, authenticated;
grant execute on function app.assert_all_tables_rls() to service_role;

alter function app.guard_profile_moderation_fields() set search_path = app, pg_catalog, pg_temp;
alter function app.search_profiles(app.gender, integer, integer, uuid, uuid, text, text, uuid, timestamptz, uuid, integer) set search_path = app, pg_temp;
alter function app.get_profile_detail(uuid) set search_path = app, pg_temp;
alter function app.send_interest(uuid, text) set search_path = app, pg_temp;
alter function app.respond_interest(uuid, app.interest_status) set search_path = app, pg_temp;
alter function app.withdraw_interest(uuid) set search_path = app, pg_temp;
alter function app.block_user(uuid, text) set search_path = app, pg_temp;
alter function app.get_contact_details(uuid) set search_path = app, pg_temp;
alter function app.add_profile_photo(uuid, text, boolean, boolean, boolean) set search_path = app, pg_temp;
alter function app.remove_profile_photo(uuid) set search_path = app, pg_temp;
alter function app.admin_review_photo(uuid, app.photo_status, text, text) set search_path = app, pg_temp;
alter function app.admin_set_profile_status(uuid, app.profile_status, text) set search_path = app, pg_temp;
alter function app.admin_get_contact(uuid, text) set search_path = app, pg_temp;
alter function app.handle_new_user() set search_path = app, pg_catalog, pg_temp;
