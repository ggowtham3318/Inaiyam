const permittedAdminEmail = (import.meta.env.VITE_ADMIN_EMAIL ?? '').trim().toLowerCase()

export function isPermittedAdminEmail(email: string | undefined) {
  return Boolean(email && email.trim().toLowerCase() === permittedAdminEmail)
}
