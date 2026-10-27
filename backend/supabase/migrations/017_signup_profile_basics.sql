-- Persist the fields collected by the first, lightweight signup step.
create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = app, pg_catalog, pg_temp
as $$
declare
  v_version text := new.raw_user_meta_data->>'policy_version';
  v_gender app.gender;
  v_profile_for app.profile_for_type;
  v_date_of_birth date;
begin
  if (new.raw_user_meta_data->>'privacy_policy_accepted') is distinct from 'true'
     or (new.raw_user_meta_data->>'terms_accepted') is distinct from 'true'
     or v_version is distinct from 'v1' then
    raise exception 'CONSENT_REQUIRED' using errcode = 'P0001';
  end if;

  v_gender := coalesce(nullif(new.raw_user_meta_data->>'gender', ''), 'other')::app.gender;
  v_profile_for := coalesce(nullif(new.raw_user_meta_data->>'profile_for', ''), 'self')::app.profile_for_type;
  v_date_of_birth := nullif(new.raw_user_meta_data->>'date_of_birth', '')::date;

  insert into app.profiles(user_id, display_name, profile_for, gender, date_of_birth)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', ''),
    v_profile_for,
    v_gender,
    v_date_of_birth
  )
  on conflict (user_id) do nothing;

  insert into app.consent_records(user_id, consent_type, policy_version, granted)
  values
    (new.id, 'privacy_policy', v_version, true),
    (new.id, 'terms_of_service', v_version, true);
  return new;
end;
$$;

alter function app.handle_new_user() set search_path = app, pg_catalog, pg_temp;
