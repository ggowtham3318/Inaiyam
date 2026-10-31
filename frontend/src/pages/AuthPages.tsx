import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, ShieldCheck, LockKeyhole, UsersRound } from 'lucide-react'
import { BRAND_NAME } from '../app/branding'
import { useAuth } from '../app/AuthContext'
import { Button, Card, Input, Thread } from '../components/ui'
import { VerifiedBadge } from '../components/ui/VerifiedBadge'
import { authRedirectError } from '../lib/supabase'
import { CONSENT_VERSION } from '../lib/consent'
import { newPasswordFormSchema, passwordUpdateErrorMessage, type NewPasswordFormValues } from '../lib/passwordSchema'
import styles from './auth-pages.module.css'

const schema = z.object({
  displayName: z.string().trim().min(2, 'Enter your full name.').max(120, 'Name must be 120 characters or fewer.').optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  dateOfBirth: z.string().optional(),
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(8, 'Use at least 8 characters.'),
  confirmPassword: z.string().optional(),
  privacyAccepted: z.boolean().optional(),
  termsAccepted: z.boolean().optional(),
}).refine(values => values.confirmPassword === undefined || values.password === values.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match.' })
type FormValues = z.infer<typeof schema>

function signupErrorMessage(error: Error) {
  const detail = error.message.toLowerCase()
  const code = (error as Error & { code?: string }).code?.toLowerCase()
  const status = (error as Error & { status?: number }).status
  if (
    code === 'user_already_exists' || code === 'email_exists' || code === 'user_already_registered' ||
    detail.includes('already registered') || detail.includes('already exists') || detail.includes('user exists')
  ) {
    return 'An account with this email already exists. Log in or reset your password.'
  }
  if (detail.includes('database error saving new user') || detail.includes('consent_required') || detail.includes('database')) {
    return 'Signup setup failed in Supabase. Apply all pending migrations to the hosted project with `supabase db push`, then try again. Do not reset the production database.'
  }
  if (status === 500) {
    return 'Supabase could not complete signup. Check the hosted project’s Auth logs and apply any pending migrations before retrying.'
  }
  if (detail.includes('email address not authorized')) {
    return 'Supabase is not allowed to email this address yet. Configure custom SMTP in the hosted project, or test with an address authorized for the project.'
  }
  if (detail.includes('rate limit') || detail.includes('too many requests')) {
    return 'Too many signup or email requests were made. Wait a few minutes and try again.'
  }
  if (detail.includes('fetch') || detail.includes('network') || detail.includes('failed to connect')) {
    return 'Could not reach Supabase. Start the local Supabase services and try again.'
  }
  return 'We could not complete signup. Please check your details and try again.'
}

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const locationState = location.state as { from?: string; notice?: string } | null
  const [serverError, setServerError] = useState(mode === 'login' && authRedirectError ? 'That email link is invalid or has expired. Try logging in, or request a new link.' : '')
  const [success, setSuccess] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { privacyAccepted: false, termsAccepted: false },
  })

  async function submit(values: FormValues) {
    setServerError('')
    setSuccess('')
    if (mode === 'register' && !values.privacyAccepted) {
      setError('privacyAccepted', { type: 'manual', message: 'Please accept the privacy notice.' })
      return
    }
    if (mode === 'register' && !values.confirmPassword) { setError('confirmPassword', { type: 'manual', message: 'Confirm your password.' }); return }
    if (mode === 'register' && (!values.displayName || !values.gender || !values.dateOfBirth)) {
      if (!values.displayName) setError('displayName', { type: 'manual', message: 'Enter your full name.' })
      if (!values.gender) setError('gender', { type: 'manual', message: 'Choose an option.' })
      if (!values.dateOfBirth) setError('dateOfBirth', { type: 'manual', message: 'Enter your date of birth.' })
      return
    }
    if (mode === 'register' && values.dateOfBirth) {
      const age = new Date().getFullYear() - new Date(values.dateOfBirth).getFullYear() - (new Date() < new Date(new Date(values.dateOfBirth).setFullYear(new Date(values.dateOfBirth).getFullYear() + 18)) ? 1 : 0)
      if (Number.isNaN(age) || age < 18) { setError('dateOfBirth', { type: 'manual', message: 'You must be at least 18 to create a profile.' }); return }
    }
    if (mode === 'register' && !values.termsAccepted) {
      setError('termsAccepted', { type: 'manual', message: 'Please accept the terms of service.' })
      return
    }

    if (mode === 'login') {
      const result = await signIn(values.email, values.password)
      if (result.error) setServerError(result.error.message)
      else navigate(locationState?.from ?? '/app')
      return
    }

    const result = await signUp(values.email, values.password, CONSENT_VERSION, { displayName: values.displayName, gender: values.gender, dateOfBirth: values.dateOfBirth })
    if (result.error) {
      setServerError(signupErrorMessage(result.error))
    }
    else if (result.needsConfirmation) navigate('/verify-otp', { state: { step: 'signup', email: values.email } })
    else navigate('/complete-profile')
  }

  return (
    <main className={`${styles.page} ${styles.authPage} ${mode === 'login' ? styles.loginPage : ''}`}>
      {mode === 'register' && <section className={styles.storyPanel} aria-label="A thoughtful beginning"><img className={styles.storyImage} src="/matrimony-couple.jpg" alt="Tamil couple celebrating their wedding" /><div className={styles.storyContent}><span className={styles.storyEyebrow}>A thoughtful beginning</span><h2>Find someone who feels right.</h2><p>Create your matrimony profile and take the first step towards finding a compatible life partner.</p><div className={styles.trustList}><span><ShieldCheck size={18} /> Your details stay private</span><span><LockKeyhole size={18} /> Secure email verification</span><span><UsersRound size={18} /> Families are welcome</span></div></div></section>}
      <Card className={styles.card}>
        <span className={styles.eyebrow}>{BRAND_NAME}</span>
        <h1>{mode === 'login' ? 'Welcome back' : 'Create your profile'}</h1>
        <p>{mode === 'login' ? 'Continue your search for a meaningful connection.' : 'A few details to get started. You can complete your profile later.'}</p>
        {mode === 'register' && <p className={styles.confirmationNote}>We’ll send a 6-digit verification code to your email. Verify it to finish creating your account.</p>}
        <Thread />
        <form onSubmit={handleSubmit(submit)} className={styles.form}>
          {mode === 'register' && <>
            <Input label="Full name" autoComplete="name" placeholder="Enter your full name" error={errors.displayName?.message} {...register('displayName')} />
            <div className={styles.fieldRow}><label className={styles.selectField}><span>Gender <small>Required</small></span><select defaultValue="" aria-invalid={Boolean(errors.gender)} {...register('gender')}><option value="" disabled>Select gender</option><option value="female">Female</option><option value="male">Male</option><option value="other">Prefer to self-describe</option></select>{errors.gender?.message && <small className={styles.fieldError}>{errors.gender.message}</small>}</label><Input label="Date of birth" type="date" autoComplete="bday" error={errors.dateOfBirth?.message} {...register('dateOfBirth')} /></div>
          </>}
          <Input label="Email address" type="email" autoComplete="email" placeholder="you@example.com" error={errors.email?.message} {...register('email')} />
          <label className={styles.passwordField}><span>Password</span><input type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="At least 8 characters" aria-invalid={Boolean(errors.password)} {...register('password')} /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>{errors.password?.message && <small className={styles.fieldError}>{errors.password.message}</small>}</label>
          {mode === 'login' && <p className={styles.forgot}><Link to="/forgot-password">Forgot your password?</Link></p>}
          {mode === 'register' && <label className={styles.passwordField}><span>Confirm password</span><input type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Re-enter your password" aria-invalid={Boolean(errors.confirmPassword)} {...register('confirmPassword')} /><button type="button" aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'} onClick={() => setShowConfirmPassword(value => !value)}>{showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>{errors.confirmPassword?.message && <small className={styles.fieldError}>{errors.confirmPassword.message}</small>}</label>}
          {mode === 'register' && (
            <fieldset className={styles.consentGroup}>
              <legend>Consent · {CONSENT_VERSION}</legend>
              <p>Review the Privacy notice and Terms of service before creating your account.</p>
              <label className={styles.consentChoice}>
                <input type="checkbox" aria-invalid={Boolean(errors.privacyAccepted)} aria-describedby={errors.privacyAccepted ? 'privacy-consent-error' : undefined} {...register('privacyAccepted')} />
                <span>I have read the <Link to="/privacy" target="_blank" rel="noreferrer">Privacy notice</Link>.</span>
              </label>
              {errors.privacyAccepted?.message && <span id="privacy-consent-error" className={styles.consentError} role="alert">{errors.privacyAccepted.message}</span>}
              <label className={styles.consentChoice}>
                <input type="checkbox" aria-invalid={Boolean(errors.termsAccepted)} aria-describedby={errors.termsAccepted ? 'terms-consent-error' : undefined} {...register('termsAccepted')} />
                <span>I agree to the <Link to="/terms" target="_blank" rel="noreferrer">Terms of service</Link>.</span>
              </label>
              {errors.termsAccepted?.message && <span id="terms-consent-error" className={styles.consentError} role="alert">{errors.termsAccepted.message}</span>}
            </fieldset>
          )}
          {locationState?.notice && !serverError && !success && <p className={styles.success} role="status">{locationState.notice}</p>}
          {serverError && <><p className={styles.error} role="alert">{serverError}</p>{mode === 'register' && <p className={styles.switch}><Link to="/login">Try logging in</Link> · <Link to="/forgot-password">Reset your password</Link></p>}</>}
          {success && <p className={styles.success} role="status">{success}</p>}
          <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account & send code'}</Button>
        </form>
        <p className={styles.switch}>
          {mode === 'login' ? `New to ${BRAND_NAME}?` : 'Already have an account?'}{' '}
          <Link to={mode === 'login' ? '/signup' : '/login'}>{mode === 'login' ? 'Create a new profile' : 'Log in'}</Link>
        </p>
      </Card>
    </main>
  )
}

const forgotSchema = z.object({ email: z.string().email('Enter a valid email address.') })
type ForgotValues = z.infer<typeof forgotSchema>

export function ForgotPasswordPage() {
  const { resetPasswordForEmail } = useAuth()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotValues>({ resolver: zodResolver(forgotSchema) })

  async function submit(values: ForgotValues) {
    setServerError('')
    const { error } = await resetPasswordForEmail(values.email)
    if (error) { setServerError('Unable to send a recovery code. Check your email and try again.'); return }
    navigate('/verify-otp', { state: { step: 'recovery', email: values.email } })
  }

  return (
    <main className={styles.page}>
      <Card className={styles.card}>
        <span className={styles.eyebrow}>{BRAND_NAME}</span>
        <h1>Reset your password</h1>
        <p>Enter your email address and we’ll send you a password recovery code.</p>
        <Thread />
        <form onSubmit={handleSubmit(submit)} className={styles.form} noValidate>
            <Input label="Email address" type="email" autoComplete="email" placeholder="you@example.com" error={errors.email?.message} {...register('email')} />
            {serverError && <p className={styles.error} role="alert">{serverError}</p>}
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Please wait…' : 'Send recovery code'}</Button>
        </form>
        <p className={styles.switch}><Link to="/login">Back to log in</Link></p>
      </Card>
    </main>
  )
}

export function ResetPasswordPage() {
  const { session, loading, updatePassword, signOut } = useAuth()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<NewPasswordFormValues>({ resolver: zodResolver(newPasswordFormSchema) })

  async function submit(values: NewPasswordFormValues) {
    setServerError('')
    const { error } = await updatePassword(values.password)
    if (error) { setServerError(passwordUpdateErrorMessage(error)); return }
    await signOut()
    navigate('/login', { replace: true, state: { notice: 'Your password has been updated. Log in with your new password.' } })
  }

  // A valid recovery code creates a short-lived session for updating the password.
  const recoveryProblem = !loading && !session
  return (
    <main className={styles.page}>
      <Card className={styles.card}>
        <span className={styles.eyebrow}>{BRAND_NAME}</span>
        <h1>Choose a new password</h1>
        <Thread />
        {loading ? <p role="status">Checking your recovery session…</p> : recoveryProblem ? (
          <div className={styles.form}>
            <p className={styles.error} role="alert">{authRedirectError?.description?.replace(/\+/g, ' ') ?? 'Your recovery code is invalid or has expired.'} Recovery codes can only be used once.</p>
            <Link to="/forgot-password"><Button type="button">Request a new code</Button></Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(submit)} className={styles.form} noValidate>
            <Input label="New password" type="password" autoComplete="new-password" placeholder="At least 8 characters" error={errors.password?.message} {...register('password')} />
            <Input label="Confirm new password" type="password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
            {serverError && <p className={styles.error} role="alert">{serverError}</p>}
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Please wait…' : 'Update password'}</Button>
          </form>
        )}
        <p className={styles.switch}><Link to="/login">Back to log in</Link></p>
      </Card>
    </main>
  )
}

export function VerifyOtpPage() {
  const { state } = useLocation() as { state: { step?: 'email' | 'mobile' | 'signup' | 'recovery'; email?: string; phone?: string; login?: boolean } | null }
  const { sendPhoneOtp, verifyOtp, resendEmailOtp, resetPasswordForEmail, user, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState<'email' | 'mobile' | 'signup' | 'recovery'>(state?.step ?? 'email')
  const [code, setCode] = useState(''); const [error, setError] = useState(''); const [seconds, setSeconds] = useState(30); const [attempts, setAttempts] = useState(0); const [lockedUntil, setLockedUntil] = useState(0); const [sent, setSent] = useState(false)
  const email = state?.email ?? user?.email ?? ''
  const phone = state?.phone ?? user?.phone ?? ''
  useEffect(() => { if (seconds <= 0) return; const timer = window.setTimeout(() => setSeconds(value => value - 1), 1000); return () => window.clearTimeout(timer) }, [seconds])
  useEffect(() => { if (step !== 'mobile' || !phone || sent) return; void sendPhoneOtp(phone).then(result => { setSent(true); if (result.error) setError('Unable to send a code. Please try again shortly.') }) }, [step, phone, sent, sendPhoneOtp])
  async function resend() {
    setError(''); setSeconds(30)
    const result = step === 'mobile' ? await sendPhoneOtp(phone)
      : step === 'signup' ? await resendEmailOtp(email)
        : step === 'recovery' ? await resetPasswordForEmail(email)
          : await resendEmailOtp(email)
    if (result.error) setError('Unable to send a code. Please try again shortly.')
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError('')
    if (lockedUntil > Date.now()) { setError('Too many incorrect codes. Try again in a few minutes.'); return }
    const result = await verifyOtp(step === 'mobile' ? { phone, token: code, type: 'phone_change' }
      : { email, token: code, type: step === 'signup' ? 'signup' : step === 'recovery' ? 'recovery' : 'email' })
    if (result.error) {
      const next = attempts + 1; setAttempts(next); setCode('')
      if (next >= 5) { setLockedUntil(Date.now() + 3 * 60_000); setAttempts(0); setError('Too many incorrect codes. Verification is locked for 3 minutes.') }
      else setError(`That code is incorrect. ${5 - next} attempts remaining.`)
      return
    }
    setAttempts(0); setCode(''); await refreshUser()
    if (step === 'email' && phone) { setStep('mobile'); setSent(false); setSeconds(30) }
    else if (step === 'recovery') navigate('/reset-password', { replace: true })
    else if (state?.login) navigate('/app', { replace: true })
    else navigate('/complete-profile', { replace: true })
  }
  const stepLabel = step === 'signup' ? 'your email' : step === 'recovery' ? 'your recovery code' : step
  return <main className={`${styles.page} ${styles.loginPage}`}><Card className={styles.card}><span className={styles.eyebrow}>{BRAND_NAME}</span><h1>Verify {stepLabel}</h1><div className={styles.verificationBadges}><VerifiedBadge verified={Boolean(user?.email_confirmed_at)} label="Email" /><VerifiedBadge verified={Boolean(user?.phone_confirmed_at)} label="Mobile" /></div><p>Enter the 6-digit code sent to {step === 'mobile' ? phone : email}.</p><Thread /><form className={styles.form} onSubmit={submit}><Input label="6-digit code" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} required />{error && <p className={styles.error} role="alert">{error}</p>}<Button type="submit" disabled={code.length !== 6}>Verify code</Button><Button type="button" variant="secondary" disabled={seconds > 0} onClick={() => void resend()}>{seconds ? `Resend code in ${seconds}s` : 'Resend code'}</Button>{step === 'mobile' && <button type="button" className={styles.textButton} onClick={() => { setStep('email'); setSent(false) }}>Change number</button>}</form><p className={styles.switch}><Link to="/login">Back to log in</Link></p></Card></main>
}
