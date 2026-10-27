import { z } from 'zod'

// Keep in sync with minimum_password_length in backend/supabase/config.toml and the hosted Auth setting.
export const MIN_PASSWORD_LENGTH = 8

export const newPasswordSchema = z.string().min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`)

export const newPasswordFormSchema = z.object({
  password: newPasswordSchema,
  confirmPassword: z.string().min(1, 'Re-enter your new password.'),
}).refine(values => values.password === values.confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword'],
})

export type NewPasswordFormValues = z.infer<typeof newPasswordFormSchema>

export function passwordUpdateErrorMessage(error: Error): string {
  const code = (error as { code?: string }).code
  if (code === 'same_password') return 'Choose a password different from your current one.'
  if (code === 'weak_password') return 'That password is too weak. Try a longer or less common one.'
  if (code === 'over_request_rate_limit') return 'Too many attempts. Please wait a few minutes and try again.'
  return error.message
}
