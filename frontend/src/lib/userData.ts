import { supabase } from './supabase'

export type PublicProfile = {
  id: string
  display_name: string | null
  age: number | null
  gender: 'male' | 'female' | 'other' | null
  height_cm: number | null
  education_name: string | null
  occupation: string | null
  city: string | null
  state: string | null
  religion_name: string | null
  caste_name: string | null
  about_me?: string | null
  marital_status_name?: string | null
  created_at: string
  email_verified?: boolean
  phone_verified?: boolean
}

export type ProfileCursor = { created_at: string; id: string }

export type Interest = {
  id: string
  sender_user_id: string
  receiver_user_id: string
  status: 'pending' | 'accepted' | 'declined' | 'withdrawn' | 'expired'
  message: string | null
  created_at: string
}

export function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured. Add the values from Frontend/.env.example to .env.local.')
  return supabase
}

export async function getOwnProfile(userId: string) {
  const client = requireSupabase()
  const result = await client.from('profiles').select('*').eq('user_id', userId).maybeSingle()
  if (result.error) throw result.error
  return result.data
}

export async function searchProfiles(filters: {
  gender?: string
  ageMin?: number
  ageMax?: number
  state?: string
  city?: string
  cursor?: ProfileCursor
  limit?: number
}) {
  const { data, error } = await requireSupabase().rpc('search_profiles', {
    p_gender: filters.gender || null,
    p_age_min: filters.ageMin ?? null,
    p_age_max: filters.ageMax ?? null,
    p_religion_id: null,
    p_caste_id: null,
    p_state: filters.state || null,
    p_city: filters.city || null,
    p_education_id: null,
    p_cursor_created_at: filters.cursor?.created_at ?? null,
    p_cursor_id: filters.cursor?.id ?? null,
    p_limit: filters.limit ?? 20,
  })
  if (error) throw error
  return (data ?? []) as PublicProfile[]
}

export async function getProfileDetail(profileId: string) {
  const { data, error } = await requireSupabase().rpc('get_profile_detail', { p_profile_id: profileId })
  if (error) throw error
  if (!data) throw new Error('This profile is unavailable or is not visible to your account.')
  return data as PublicProfile
}

export async function getPhotoPreviewUrl(bucket: string, path: string) {
  const { data, error } = await requireSupabase().storage.from(bucket).createSignedUrl(path, 10 * 60)
  if (error) throw error
  return data.signedUrl
}
