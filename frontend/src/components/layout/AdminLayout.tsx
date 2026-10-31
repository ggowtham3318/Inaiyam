import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { BarChart3, FileCheck2, LayoutDashboard, LogOut, Users, MessageSquare, ShieldCheck, ExternalLink, UserRoundX } from 'lucide-react'
import { useAuth } from '../../app/AuthContext'
import { BrandMark } from './PublicLayout'
import styles from './layout.module.css'

const links = [{ to: '/admin', label: 'Overview', icon: LayoutDashboard }, { to: '/admin/approvals', label: 'Profile reviews', icon: FileCheck2 }, { to: '/admin/reports', label: 'Reports', icon: BarChart3 }, { to: '/admin/users', label: 'Users', icon: Users }, { to: '/admin/deletions', label: 'Deletion requests', icon: UserRoundX }, { to: '/admin/messages', label: 'Contact messages', icon: MessageSquare }]
export function AdminLayout() {
  const { signOut, user } = useAuth(); const navigate = useNavigate()
  return <div className={styles.adminLayout}><aside className={styles.adminSidebar}><BrandMark /><div className={styles.adminIdentity}><span className={styles.adminIdentityIcon}><ShieldCheck size={16} /></span><div><strong>Admin console</strong><small>Staff workspace</small></div></div><p className={styles.adminLabel}>Manage Inaiyam</p><nav aria-label="Admin navigation">{links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/admin'} title={label}><Icon size={17} /><span className={styles.adminNavText}>{label}</span></NavLink>)}</nav><div className={styles.adminAccount}><span>{user?.email}</span><small>Verified administrator</small></div><a className={styles.memberLink} href="/app"><ExternalLink size={15} />Member site</a><button className={styles.logoutLink} aria-label="Log out" onClick={() => void signOut().then(() => navigate('/'))}><LogOut size={17} /><span>Log out</span></button></aside><main className={styles.adminMain}><header className={styles.adminTopbar}><div><strong>Admin console</strong><span> · Inaiyam Matrimony operations</span></div><span className={styles.badge}><ShieldCheck size={13} /> Protected staff area</span></header><Outlet /></main></div>
}
