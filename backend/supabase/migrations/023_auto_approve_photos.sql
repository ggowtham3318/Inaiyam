-- New profile photos are published as soon as the owner uploads them.
-- The app still keeps the approved bucket private and applies profile/block access rules.
drop policy if exists photos_approved_owner_upload on storage.objects;
create policy photos_approved_owner_upload on storage.objects
for insert to authenticated
with check (
  bucket_id = 'photos-approved'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from app.profiles p
    where p.user_id = (select auth.uid()) and p.deleted_at is null
  )
);

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
    where bucket_id = 'photos-approved' and name = p_storage_path
  ) then
    raise exception 'PHOTO_OBJECT_NOT_FOUND' using errcode = 'P0001';
  end if;
  if (select count(*) from app.profile_photos
      where profile_id = p_profile_id and status in ('pending', 'approved')) >= 6 then
    raise exception 'PHOTO_LIMIT_REACHED' using errcode = 'P0001';
  end if;
  insert into app.profile_photos(
    profile_id, uploaded_by, storage_bucket, storage_path,
    is_primary, is_blurred, is_private, status, reviewed_at, rejection_reason
  ) values (
    p_profile_id, auth.uid(), 'photos-approved', p_storage_path,
    p_is_primary, p_is_blurred, p_is_private, 'approved', now(), null
  ) returning * into v_photo;
  perform app.write_audit(
    'upload_profile_photo', 'profile_photos', v_photo.id,
    null, to_jsonb(v_photo), null
  );
  return v_photo;
end;
$$;

revoke all on function app.add_profile_photo(uuid, text, boolean, boolean, boolean) from public, anon;
grant execute on function app.add_profile_photo(uuid, text, boolean, boolean, boolean) to authenticated;
