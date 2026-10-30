import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export type UserRole = 'user' | 'admin' | 'moderator'
type AuthContextValue = {
  session: Session | null
  user: User | null
  role: UserRole | null
  roleError: string | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null; emailConfirmed: boolean; phoneConfirmed: boolean }>
  signUp: (email: string, password: string, policyVersion: string, profile?: { displayName?: string; gender?: string; dateOfBirth?: string }) => Promise<{ error: Error | null; needsConfirmation: boolean }>
  signOut: () => Promise<{ error: Error | null }>
  resetPasswordForEmail: (email: string) => Promise<{ error: Error | null }>
  updatePassword: (password: string) => Promise<{ error: Error | null }>
  sendPhoneOtp: (phone: string) => Promise<{ error: Error | null }>
  verifyOtp: (input: { email: string; token: string; type: 'signup' | 'email' | 'recovery' } | { phone: string; token: string; type: 'phone_change' | 'sms' }) => Promise<{ error: Error | null }>
  resendEmailOtp: (email: string) => Promise<{ error: Error | null }>
  requestPhoneRecovery: (phone: string) => Promise<{ error: Error | null }>
  refreshUser: () => Promise<User | null>
}

const NOT_CONFIGURED = 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)
  const [roleError, setRoleError] = useState<string | null>(null)
  const [roleLoading, setRoleLoading] = useState(false)
  const [loading, setLoading] = useState(true)

  async function loadRole(userId: string) {
    if (!supabase) throw new Error('Supabase is not configured.')
    const { data, error } = await supabase.from('user_roles').select('role').eq('user_id', userId).order('role').limit(1).maybeSingle()
    if (error) throw error
    return data?.role === 'admin' || data?.role === 'moderator' ? data.role : 'user' as UserRole
  }

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    let mounted = true
    void supabase.auth.getSession().then(async ({ data, error }) => {
      if (!mounted) return
      if (error) {
        setRoleError('Unable to verify your account access. Sign out and try again.')
        setLoading(false)
        return
      }
      setSession(data.session)
      if (data.session?.user) {
        setRoleLoading(true)
        try {
          setRole(await loadRole(data.session.user.id))
          setRoleError(null)
        } catch {
          setRole(null)
          setRoleError('Unable to verify your account access. Sign out and try again.')
        } finally {
          setRoleLoading(false)
        }
      } else {
        setRole(null)
      }
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (!nextSession) {
        setRole(null)
        setRoleError(null)
        setRoleLoading(false)
        return
      }
      setRoleLoading(true)
      setRoleError(null)
      void loadRole(nextSession.user.id)
        .then(nextRole => { setRole(nextRole); setRoleError(null) })
        .catch(() => { setRole(null); setRoleError('Unable to verify your account access. Sign out and try again.') })
        .finally(() => setRoleLoading(false))
    })
    return () => { mounted = false; listener.subscription.unsubscribe() }
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    role,
    roleError,
    loading: loading || roleLoading,
    signIn: async (email, password) => {
      if (!supabase) return { error: new Error(NOT_CONFIGURED), emailConfirmed: false, phoneConfirmed: false }
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      return { error, emailConfirmed: Boolean(data.user?.email_confirmed_at), phoneConfirmed: Boolean(data.user?.phone_confirmed_at) }
    },
    signUp: async (email, password, policyVersion, profile) => {
      if (!supabase) return { error: new Error(NOT_CONFIGURED), needsConfirmation: false }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: {
            privacy_policy_accepted: true,
            terms_accepted: true,
            policy_version: policyVersion,
            display_name: profile?.displayName?.trim(),
            gender: profile?.gender,
            date_of_birth: profile?.dateOfBirth,
          },
        },
      })
      // With email confirmation enabled Supabase returns no session until the link is opened.
      return { error, needsConfirmation: !error && !data.session }
    },
    signOut: async () => {
      if (!supabase) return { error: null }
      const { error } = await supabase.auth.signOut()
      return { error }
    },
    resetPasswordForEmail: async email => {
      if (!supabase) return { error: new Error(NOT_CONFIGURED) }
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` })
      return { error }
    },
    updatePassword: async password => {
      if (!supabase) return { error: new Error(NOT_CONFIGURED) }
      const { error } = await supabase.auth.updateUser({ password })
      return { error }
    },
    sendPhoneOtp: async phone => {
      if (!supabase) return { error: new Error(NOT_CONFIGURED) }
      const { error } = await supabase.auth.updateUser({ phone })
      return { error }
    },
    verifyOtp: async input => {
      if (!supabase) return { error: new Error(NOT_CONFIGURED) }
      const { error } = await supabase.auth.verifyOtp(input)
      return { error }
    },
    resendEmailOtp: async email => {
      if (!supabase) return { error: new Error(NOT_CONFIGURED) }
      const { error } = await supabase.auth.resend({ type: 'signup', email })
      return { error }
    },
    requestPhoneRecovery: async phone => {
      if (!supabase) return { error: new Error(NOT_CONFIGURED) }
      const { error } = await supabase.auth.signInWithOtp({ phone, options: { shouldCreateUser: false } })
      return { error }
    },
    refreshUser: async () => {
      if (!supabase) return null
      const { data } = await supabase.auth.getUser()
      return data.user
    },
  }), [loading, role, roleError, roleLoading, session])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
