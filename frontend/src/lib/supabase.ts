import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export type AuthRedirectError = { code: string | null; description: string | null }

// Supabase reports failed email-link redirects (expired or already-used links) in the URL hash.
// Read it once at module load, before the client below processes the URL.
function readAuthRedirectError(): AuthRedirectError | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  if (!params.get('error') && !params.get('error_code')) return null
  return { code: params.get('error_code'), description: params.get('error_description') }
}

export const authRedirectError = readAuthRedirectError()

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      db: { schema: 'app' },
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null
