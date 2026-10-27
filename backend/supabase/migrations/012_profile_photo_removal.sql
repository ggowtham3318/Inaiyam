create or replace function app.remove_profile_photo(p_photo_id uuid)
returns app.profile_photos
language plpgsql
security definer
set search_path = app, public, storage, pg_temp
as $$
declare
  v_photo app.profile_photos;
begin
  select ph into v_photo
  from app.profile_photos ph
  join app.profiles p on p.id = ph.profile_id
  where ph.id = p_photo_id and p.user_id = auth.uid()
  for update;

  if not found then
    raise exception 'PHOTO_NOT_FOUND' using errcode = 'P0001';
  end if;

  delete from storage.objects
  where bucket_id = v_photo.storage_bucket and name = v_photo.storage_path;
  delete from app.profile_photos where id = p_photo_id;
  return v_photo;
end;
$$;

revoke all on function app.remove_profile_photo(uuid) from public;
grant execute on function app.remove_profile_photo(uuid) to authenticated;
