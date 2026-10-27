import { getPhotoPreviewUrl, requireSupabase } from './userData'

export type AdminStats = {
  total_profiles: number
  pending_profiles: number
  pending_photos: number
  open_reports: number
}

export type AdminUser = { user_id: string; email: string; status: string; created_at: string }
export type PendingProfile = { id: string; user_id: string; display_name: string | null; status: string; city: string | null; created_at: string }
export type PendingPhoto = { id: string; profile_id: string; uploaded_by: string; storage_bucket: string; storage_path: string; status: string; created_at: string; preview_url: string }
export type AdminReport = { id: string; reporter_user_id: string; reported_user_id: string; category: string; description: string; status: string; resolution_notes: string | null; created_at: string }
export type AdminDeletionRequest = { id: string; user_id: string; status: string; reason: string | null; requested_at: string; completed_at: string | null }
export type AdminContactMessage = { id: string; name: string; email: string; message: string; created_at: string; handled_at: string | null }
export type CmsPage = { id: string; slug: string; title: string; content: string; status: 'draft' | 'published' | 'archived'; updated_at: string }
export type CmsStory = { id: string; title: string; story: string; image_path: string | null; is_published: boolean; updated_at: string }

export async function getAdminStats() {
  const { data, error } = await requireSupabase().rpc('admin_dashboard_stats')
  if (error) throw error
  return data as AdminStats
}

export async function getAdminUsers() {
  const { data, error } = await requireSupabase().rpc('admin_list_users')
  if (error) throw error
  return (data ?? []) as AdminUser[]
}

export async function getPendingProfiles() {
  const { data, error } = await requireSupabase().rpc('admin_list_pending_profiles')
  if (error) throw error
  return (data ?? []) as PendingProfile[]
}

export async function getPendingPhotos() {
  const { data, error } = await requireSupabase().rpc('admin_list_pending_photos')
  if (error) throw error
  return Promise.all(((data ?? []) as Omit<PendingPhoto, 'preview_url'>[]).map(async photo => ({
    ...photo,
    preview_url: await getPhotoPreviewUrl(photo.storage_bucket, photo.storage_path),
  })))
}

export async function setProfileStatus(profileId: string, status: 'approved' | 'rejected' | 'suspended' | 'deleted', reason?: string) {
  const { error } = await requireSupabase().rpc('admin_set_profile_status', { p_profile_id: profileId, p_status: status, p_reason: reason || null })
  if (error) throw error
}

export async function reviewPhoto(photoId: string, status: 'approved' | 'rejected', reason?: string) {
  const { error } = await requireSupabase().functions.invoke('review-photo', {
    body: { photo_id: photoId, status, reason: reason || null },
  })
  if (error) throw error
}

export async function getAdminReports() {
  const { data, error } = await requireSupabase().from('reports').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as AdminReport[]
}

export async function updateReport(id: string, status: 'reviewing' | 'resolved' | 'dismissed', resolutionNotes: string) {
  const { error } = await requireSupabase().from('reports').update({
    status,
    resolution_notes: resolutionNotes || null,
    resolved_at: status === 'resolved' || status === 'dismissed' ? new Date().toISOString() : null,
  }).eq('id', id)
  if (error) throw error
}

export async function getDeletionRequests() {
  const { data, error } = await requireSupabase().from('account_deletion_requests').select('id,user_id,status,reason,requested_at,completed_at').order('requested_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as AdminDeletionRequest[]
}

export async function completeDeletionRequest(id: string, reviewerId: string) {
  const { error } = await requireSupabase().from('account_deletion_requests').update({ status: 'completed', completed_at: new Date().toISOString(), reviewed_by: reviewerId }).eq('id', id)
  if (error) throw error
}

export async function getAdminContactMessages() {
  const { data, error } = await requireSupabase().from('contact_messages').select('id,name,email,message,created_at,handled_at').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as AdminContactMessage[]
}

export async function markContactMessageHandled(id: string, staffId: string) {
  const { error } = await requireSupabase().from('contact_messages').update({ handled_at: new Date().toISOString(), handled_by: staffId }).eq('id', id)
  if (error) throw error
}

export async function getCmsPages() {
  const { data, error } = await requireSupabase().from('cms_pages').select('id,slug,title,content,status,updated_at').order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as CmsPage[]
}

export async function saveCmsPage(page: Pick<CmsPage, 'id' | 'slug' | 'title' | 'content' | 'status'>) {
  const payload = { slug: page.slug, title: page.title, content: page.content, status: page.status }
  const result = page.id ? await requireSupabase().from('cms_pages').update(payload).eq('id', page.id) : await requireSupabase().from('cms_pages').insert(payload)
  if (result.error) throw result.error
}

export async function getCmsStories() {
  const { data, error } = await requireSupabase().from('cms_success_stories').select('id,title,story,image_path,is_published,updated_at').order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as CmsStory[]
}

export async function saveCmsStory(story: Pick<CmsStory, 'id' | 'title' | 'story' | 'is_published'>) {
  const payload = { title: story.title, story: story.story, is_published: story.is_published }
  const result = story.id ? await requireSupabase().from('cms_success_stories').update(payload).eq('id', story.id) : await requireSupabase().from('cms_success_stories').insert(payload)
  if (result.error) throw result.error
}
