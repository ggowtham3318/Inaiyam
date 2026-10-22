import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { BRAND_NAME } from '../app/branding'
import { useAuth } from '../app/AuthContext'
import { Button, Card, Input, Thread } from '../components/ui'
import styles from './auth-pages.module.css'

const STAGING_POLICY_VERSION = 'staging-v1'
const schema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(8, 'Use at least 8 characters.'),
  privacyAccepted: z.boolean().optional(),
  termsAccepted: z.boolean().optional(),
})
type FormValues = z.infer<typeof schema>

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [serverError, setServerError] = useState('')
  const [success, setSuccess] = useState('')
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { privacyAccepted: false, termsAccepted: false },
  })

  async function submit(values: FormValues) {
    setServerError('')
    setSuccess('')
    if (mode === 'register' && !values.privacyAccepted) {
      setError('privacyAccepted', { type: 'manual', message: 'Please accept the staging privacy notice.' })
      return
    }
    if (mode === 'register' && !values.termsAccepted) {
      setError('termsAccepted', { type: 'manual', message: 'Please accept the staging terms.' })
      return
    }

    const result = mode === 'login'
      ? await signIn(values.email, values.password)
      : await signUp(values.email, values.password, STAGING_POLICY_VERSION)

    if (result.error) setServerError(result.error.message)
    else if (mode === 'login') navigate((location.state as { from?: string } | null)?.from ?? '/app')
    else setSuccess(`Consent recorded for ${STAGING_POLICY_VERSION}. Check your email to confirm your account, then return to sign in.`)
  }

  return (
    <main className={styles.page}>
      <Card className={styles.card}>
        <span className={styles.eyebrow}>{BRAND_NAME}</span>
        <h1>{mode === 'login' ? 'Welcome back' : 'Begin your journey'}</h1>
        <p>{mode === 'login' ? 'Continue your search for a meaningful connection.' : 'Create a private profile for you and your family.'}</p>
        <Thread />
        <form onSubmit={handleSubmit(submit)} className={styles.form}>
          <Input label="Email address" type="email" autoComplete="email" placeholder="you@example.com" error={errors.email?.message} {...register('email')} />
          <Input label="Password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="At least 8 characters" error={errors.password?.message} {...register('password')} />
          {mode === 'register' && (
            <fieldset className={styles.consentGroup}>
              <legend>Staging consent · {STAGING_POLICY_VERSION}</legend>
              <p>This staging copy is for internal testing only; it is not final legal advice or an approved public policy.</p>
              <label className={styles.consentChoice}>
                <input type="checkbox" aria-invalid={Boolean(errors.privacyAccepted)} aria-describedby={errors.privacyAccepted ? 'privacy-consent-error' : undefined} {...register('privacyAccepted')} />
                <span>I have read the <Link to="/privacy" target="_blank" rel="noreferrer">staging privacy notice</Link>.</span>
              </label>
              {errors.privacyAccepted?.message && <span id="privacy-consent-error" className={styles.consentError} role="alert">{errors.privacyAccepted.message}</span>}
              <label className={styles.consentChoice}>
                <input type="checkbox" aria-invalid={Boolean(errors.termsAccepted)} aria-describedby={errors.termsAccepted ? 'terms-consent-error' : undefined} {...register('termsAccepted')} />
                <span>I agree to the <Link to="/terms" target="_blank" rel="noreferrer">staging terms</Link>.</span>
              </label>
              {errors.termsAccepted?.message && <span id="terms-consent-error" className={styles.consentError} role="alert">{errors.termsAccepted.message}</span>}
            </fieldset>
          )}
          {serverError && <p className={styles.error} role="alert">{serverError}</p>}
          {success && <p className={styles.success} role="status">{success}</p>}
          <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}</Button>
        </form>
        <p className={styles.switch}>
          {mode === 'login' ? `New to ${BRAND_NAME}?` : 'Already have an account?'}{' '}
          <Link to={mode === 'login' ? '/register' : '/login'}>{mode === 'login' ? 'Register' : 'Log in'}</Link>
        </p>
      </Card>
    </main>
  )
}
