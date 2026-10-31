import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Heart, Home, LogOut, Search, UserRound, Sparkles, Settings } from 'lucide-react'
import { BrandMark } from './PublicLayout'
import { useAuth } from '../../app/AuthContext'
import { Button, Modal } from '../ui'
import styles from './layout.module.css'

const links = [{ to: '/app', label: 'Dashboard', icon: Home }, { to: '/app/search', label: 'Discover', icon: Search }, { to: '/app/shortlist', label: 'Shortlist', icon: Heart }, { to: '/app/interests', label: 'Interests', icon: Sparkles }, { to: '/app/profile', label: 'My profile', icon: UserRound }, { to: '/app/settings', label: 'Settings', icon: Settings }]
export function UserLayout() {
  const [confirmLogout, setConfirmLogout] = useState(false)
  const { signOut } = useAuth(); const navigate = useNavigate()
  async function logout() { const { error } = await signOut(); if (!error) navigate('/') }
  return <div className={styles.appLayout}><header className={styles.appHeader}><BrandMark /><nav className={styles.memberNav}>{links.map(({ to, label }) => <NavLink key={to} to={to} end={to === '/app'}>{label}</NavLink>)}</nav><div className={styles.appActions}><span className={styles.welcome}>Your private space</span><Button variant="ghost" icon={<LogOut size={16} />} onClick={() => setConfirmLogout(true)}>Log out</Button></div></header><main className={styles.appMain}><Outlet /></main><nav className={styles.bottomNav}>{links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/app'}><Icon size={19} /><span>{label}</span></NavLink>)}</nav><Modal title="Log out?" open={confirmLogout} onClose={() => setConfirmLogout(false)}><p>Are you sure you want to log out of your profile?</p><div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}><Button variant="secondary" onClick={() => setConfirmLogout(false)}>Cancel</Button><Button onClick={() => void logout()}>Log out</Button></div></Modal></div>
}
