import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, ShieldCheck, LockKeyhole, UsersRound } from 'lucide-react'
import { BRAND_NAME } from '../app/branding'
import { useAuth } from '../app/AuthContext'
import { Button, Card, Input, Thread } from '../components/ui'
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
  privacyAccepted: z.boolean().optional(),
  termsAccepted: z.boolean().optional(),
})
type FormValues = z.infer<typeof schema>

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const locationState = location.state as { from?: string; notice?: string } | null
  const [serverError, setServerError] = useState(mode === 'login' && authRedirectError ? 'That email link is invalid or has expired. Try logging in, or request a new link.' : '')
  const [success, setSuccess] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loginMethod, setLoginMethod] = useState<'password' | 'otp'>('password')
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
      setServerError(result.error.message.toLowerCase().includes('database error saving new user')
        ? 'We could not finish setting up your account on the server. Please try again later. If this keeps happening, contact support.'
        : result.error.message)
    }
    else if (result.needsConfirmation) setSuccess(`We sent a confirmation link to ${values.email}. Open it to activate your account, then return here to log in. If you don't see it within a few minutes, check your spam folder.`)
    else navigate('/complete-profile') // Confirmation is off (local development): Supabase already signed the user in.
  }

  return (
    <main className={`${styles.page} ${styles.authPage} ${mode === 'login' ? styles.loginPage : ''}`}>
      {mode === 'register' && <section className={styles.storyPanel} aria-label="A thoughtful beginning"><img className={styles.storyImage} src="/matrimony-couple.jpg" alt="Tamil couple celebrating their wedding" /><div className={styles.storyContent}><span className={styles.storyEyebrow}>A thoughtful beginning</span><h2>Find someone who feels right.</h2><p>Create your matrimony profile and take the first step towards finding a compatible life partner.</p><div className={styles.trustList}><span><ShieldCheck size={18} /> Your details stay private</span><span><LockKeyhole size={18} /> Secure email verification</span><span><UsersRound size={18} /> Families are welcome</span></div></div></section>}
      <Card className={styles.card}>
        <span className={styles.eyebrow}>{BRAND_NAME}</span>
        <h1>{mode === 'login' ? 'Welcome back' : 'Create your profile'}</h1>
        <p>{mode === 'login' ? 'Continue your search for a meaningful connection.' : 'A few details to get started. You can complete your profile later.'}</p>
        {mode === 'register' && <p className={styles.confirmationNote}>We’ll send a confirmation link to your email. Email confirmation is required before you can log in.</p>}
        <Thread />
        <form onSubmit={handleSubmit(submit)} className={styles.form}>
          {mode === 'register' && <>
            <Input label="Full name" autoComplete="name" placeholder="Enter your full name" error={errors.displayName?.message} {...register('displayName')} />
            <div className={styles.fieldRow}><label className={styles.selectField}><span>Gender <small>Required</small></span><select defaultValue="" aria-invalid={Boolean(errors.gender)} {...register('gender')}><option value="" disabled>Select gender</option><option value="female">Female</option><option value="male">Male</option><option value="other">Prefer to self-describe</option></select>{errors.gender?.message && <small className={styles.fieldError}>{errors.gender.message}</small>}</label><Input label="Date of birth" type="date" autoComplete="bday" error={errors.dateOfBirth?.message} {...register('dateOfBirth')} /></div>
          </>}
          <Input label="Email address" type="email" autoComplete="email" placeholder="you@example.com" error={errors.email?.message} {...register('email')} />
          {mode === 'login' && <div className={styles.methodSwitch} role="group" aria-label="Login method"><button type="button" className={loginMethod === 'password' ? styles.methodActive : ''} onClick={() => setLoginMethod('password')}>Password</button><button type="button" className={loginMethod === 'otp' ? styles.methodActive : ''} onClick={() => setLoginMethod('otp')}>OTP</button></div>}
          {mode === 'login' && loginMethod === 'otp' ? <p className={styles.info} role="status">One-time-code sign-in is not enabled yet. Use your email and password to log in.</p> : <label className={styles.passwordField}><span>Password</span><input type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="At least 8 characters" aria-invalid={Boolean(errors.password)} {...register('password')} /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>{errors.password?.message && <small className={styles.fieldError}>{errors.password.message}</small>}</label>}
          {mode === 'login' && <p className={styles.forgot}><Link to="/forgot-password">Forgot your password?</Link></p>}
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
          {serverError && <p className={styles.error} role="alert">{serverError}</p>}
          {success && <p className={styles.success} role="status">{success}</p>}
          <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}</Button>
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
  const [serverError, setServerError] = useState('')
  const [sentTo, setSentTo] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotValues>({ resolver: zodResolver(forgotSchema) })

  async function submit(values: ForgotValues) {
    setServerError('')
    const { error } = await resetPasswordForEmail(values.email)
    if (!error) { setSentTo(values.email); return }
    const code = (error as { code?: string }).code
    setServerError(code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit'
      ? 'Too many reset requests. Please wait a few minutes before trying again.'
      : error.message)
  }

  return (
    <main className={styles.page}>
      <Card className={styles.card}>
        <span className={styles.eyebrow}>{BRAND_NAME}</span>
        <h1>Reset your password</h1>
        <p>Enter the email address you registered with and we will send you a link to choose a new password.</p>
        <Thread />
        {sentTo ? (
          <div className={styles.form}>
            <p className={styles.success} role="status">If an account exists for {sentTo}, a reset link is on its way. It can take a few minutes to arrive; check your spam folder too. The link works once and expires after a short time.</p>
            <Button type="button" variant="secondary" onClick={() => setSentTo('')}>Use a different email</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(submit)} className={styles.form} noValidate>
            <Input label="Email address" type="email" autoComplete="email" placeholder="you@example.com" error={errors.email?.message} {...register('email')} />
            {serverError && <p className={styles.error} role="alert">{serverError}</p>}
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Please wait…' : 'Send reset link'}</Button>
          </form>
        )}
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

  // The recovery link signs the user in with a short-lived session; without one the link was invalid, expired or already used.
  const linkProblem = !loading && !session
  return (
    <main className={styles.page}>
      <Card className={styles.card}>
        <span className={styles.eyebrow}>{BRAND_NAME}</span>
        <h1>Choose a new password</h1>
        <Thread />
        {loading ? <p role="status">Checking your reset link…</p> : linkProblem ? (
          <div className={styles.form}>
            <p className={styles.error} role="alert">{authRedirectError?.description?.replace(/\+/g, ' ') ?? 'This reset link is invalid or has expired.'} Reset links can only be used once.</p>
            <Link to="/forgot-password"><Button type="button">Request a new link</Button></Link>
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
  return <main className={`${styles.page} ${styles.loginPage}`}><Card className={styles.card}><span className={styles.eyebrow}>{BRAND_NAME}</span><h1>Phone verification</h1><p>Phone OTP verification is not configured for this account yet. No code has been sent and your number has not been verified.</p><p className={styles.info}>You can create an account with email confirmation or log in with your registered email and password.</p><Link to="/signup"><Button type="button">Create a new profile</Button></Link><p className={styles.switch}><Link to="/login">Back to log in</Link></p></Card></main>
}
