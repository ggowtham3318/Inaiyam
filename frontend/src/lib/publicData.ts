import { supabase } from './supabase'

export type PublicStats = { approved_profiles: number }
export type PublishedStory = {
  id: string
  title: string
  story: string
  image_path: string | null
}

export async function fetchPublicStats(): Promise<PublicStats> {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase.rpc('public_stats')
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  return { approved_profiles: Number(row?.approved_profiles ?? 0) }
}

export async function fetchPublishedStories(): Promise<PublishedStory[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('cms_success_stories')
    .select('id,title,story,image_path')
    .eq('is_published', true)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data ?? []
}
