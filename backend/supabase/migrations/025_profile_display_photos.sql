-- Expose only the approved photo path that the current member is allowed to view.
create or replace function app.get_profile_photos(p_profile_id uuid)
returns table (storage_bucket text, storage_path text)
language sql
stable
security definer
set search_path = app, pg_catalog, pg_temp
as $$
  select photo.storage_bucket, photo.storage_path
  from app.profile_photos photo
  where photo.profile_id = p_profile_id
    and photo.status = 'approved'
    and photo.storage_bucket = 'photos-approved'
    and app.can_view_profile_photo(photo.storage_path)
  order by photo.is_primary desc, photo.created_at asc
  limit 1;
$$;

revoke all on function app.get_profile_photos(uuid) from public, anon;
grant execute on function app.get_profile_photos(uuid) to authenticated;
