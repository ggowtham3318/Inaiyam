alter table app.profiles add column if not exists email_verified boolean not null default false;
alter table app.profiles add column if not exists phone_verified boolean not null default false;

create or replace function app.is_fully_verified()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u
    where u.id = (select auth.uid())
      and u.email_confirmed_at is not null
      and u.phone_confirmed_at is not null
  );
$$;
revoke all on function app.is_fully_verified() from public, anon;
grant execute on function app.is_fully_verified() to authenticated;

-- Keep the established RPC behavior while adding a database verification gate.
alter function app.send_interest(uuid, text) rename to send_interest_unverified;
create function app.send_interest(p_receiver_profile_id uuid, p_message text default null)
returns app.interests language plpgsql security definer set search_path = app, pg_temp as $$
begin
  if not app.is_fully_verified() then raise exception 'VERIFICATION_REQUIRED' using errcode = 'P0001'; end if;
  return app.send_interest_unverified(p_receiver_profile_id, p_message);
end; $$;
alter function app.toggle_shortlist(uuid) rename to toggle_shortlist_unverified;
create function app.toggle_shortlist(p_profile_id uuid) returns boolean
language plpgsql security definer set search_path = app, pg_temp as $$
begin
  if not app.is_fully_verified() then raise exception 'VERIFICATION_REQUIRED' using errcode = 'P0001'; end if;
  return app.toggle_shortlist_unverified(p_profile_id);
end; $$;
alter function app.submit_profile_for_review(uuid) rename to submit_profile_for_review_unverified;
create function app.submit_profile_for_review(p_profile_id uuid) returns app.profiles
language plpgsql security definer set search_path = app, pg_temp as $$
begin
  if not app.is_fully_verified() then raise exception 'VERIFICATION_REQUIRED' using errcode = 'P0001'; end if;
  return app.submit_profile_for_review_unverified(p_profile_id);
end; $$;
alter function app.get_contact_details(uuid) rename to get_contact_details_unverified;
create function app.get_contact_details(p_target_user_id uuid) returns app.user_contact_details
language plpgsql security definer set search_path = app, pg_temp as $$
begin
  if not app.is_fully_verified() then raise exception 'VERIFICATION_REQUIRED' using errcode = 'P0001'; end if;
  return app.get_contact_details_unverified(p_target_user_id);
end; $$;
revoke all on function app.send_interest_unverified(uuid, text), app.toggle_shortlist_unverified(uuid),
  app.submit_profile_for_review_unverified(uuid), app.get_contact_details_unverified(uuid) from public, anon, authenticated;
grant execute on function app.send_interest(uuid, text), app.toggle_shortlist(uuid),
  app.submit_profile_for_review(uuid), app.get_contact_details(uuid) to authenticated;

create or replace function app.guard_verified_writes()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not app.is_fully_verified() then raise exception 'VERIFICATION_REQUIRED' using errcode = 'P0001'; end if;
  return new;
end; $$;
drop trigger if exists verified_interest_guard on app.interests;
create trigger verified_interest_guard before insert on app.interests for each row execute function app.guard_verified_writes();
drop trigger if exists verified_shortlist_guard on app.shortlists;
create trigger verified_shortlist_guard before insert on app.shortlists for each row execute function app.guard_verified_writes();

create or replace function app.sync_profile_verification()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update app.profiles
  set email_verified = new.email_confirmed_at is not null,
      phone_verified = new.phone_confirmed_at is not null
  where user_id = new.id;
  return new;
end;
$$;
drop trigger if exists sync_profile_verification on auth.users;
create trigger sync_profile_verification after insert or update of email_confirmed_at, phone_confirmed_at on auth.users
for each row execute function app.sync_profile_verification();

update app.profiles p set
  email_verified = u.email_confirmed_at is not null,
  phone_verified = u.phone_confirmed_at is not null
from auth.users u where u.id = p.user_id;

create or replace view app.public_profiles
with (security_barrier = true)
as
select p.id, p.gender,
  extract(year from age(current_date, p.date_of_birth))::integer as age,
  p.profile_for, p.display_name, p.mother_tongue, p.religion_id,
  religion.name as religion_name, p.caste_id, caste.name as caste_name,
  p.marital_status_id, ms.name as marital_status_name, p.height_cm, p.state,
  p.city, p.education_id, e.name as education_name, p.occupation_category_id,
  oc.name as occupation_category_name, p.occupation, p.created_at, p.about_me,
  p.email_verified, p.phone_verified
from app.profiles p
left join app.lookup_religions religion on religion.id = p.religion_id
left join app.lookup_castes caste on caste.id = p.caste_id
left join app.lookup_marital_statuses ms on ms.id = p.marital_status_id
left join app.lookup_education e on e.id = p.education_id
left join app.lookup_occupation_categories oc on oc.id = p.occupation_category_id
where p.status = 'approved' and p.deleted_at is null;
