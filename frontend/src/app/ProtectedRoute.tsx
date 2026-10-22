import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth, type UserRole } from './AuthContext'
import { isPermittedAdminEmail } from './adminAccess'
import { FullPageState } from '../components/layout/FullPageState'

export function ProtectedRoute({ role }: { role: 'user' | 'admin' }) {
  const { session, role: currentRole, roleError, loading, signOut } = useAuth()
  const location = useLocation()
  if (loading) return <FullPageState label="Opening your Inaiyam Matrimony account…" />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (roleError) return <main role="alert" style={{ margin: '3rem auto', maxWidth: 560, padding: '1.5rem' }}><h1>Access could not be verified</h1><p>{roleError}</p><button type="button" onClick={() => void signOut()}>Sign out</button></main>
  const permittedAdmin = currentRole === 'admin' && Boolean(session.user.email_confirmed_at) && isPermittedAdminEmail(session.user.email)
  if (role === 'user' && currentRole === 'admin') {
    if (permittedAdmin) return <Navigate to="/admin" replace />
    return <main role="alert" style={{ margin: '3rem auto', maxWidth: 560, padding: '1.5rem' }}><h1>Administrator access is not enabled</h1><p>This account is not included in the staging administrator allow-list.</p><button type="button" onClick={() => void signOut()}>Sign out</button></main>
  }
  const allowed = role === 'admin'
    ? permittedAdmin
    : Boolean(currentRole && ['user', 'moderator'].includes(currentRole as UserRole))
  if (!allowed) return <Navigate to="/app" replace />
  return <Outlet />
}
