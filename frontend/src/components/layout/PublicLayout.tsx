import { Link, NavLink, Outlet } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { BRAND_NAME } from '../../app/branding'
import { Button, Kolam, LanguageToggle, Thread } from '../ui'
import { useI18n } from '../../app/I18nContext'
import { AnimatePresence, motion } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import styles from './layout.module.css'

export function BrandMark() {
  return <Link to="/" className={styles.brand} aria-label={`${BRAND_NAME} home`}><span className={styles.brandIcon} aria-hidden="true"><svg viewBox="0 0 28 28" width="21" height="21"><path d="M5 8c4-5 14-5 18 0M5 20c4 5 14 5 18 0M8 5c5 4 5 14 0 18M20 5c-5 4-5 14 0 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /><circle cx="14" cy="14" r="2.2" fill="currentColor" /></svg></span><span><strong>{BRAND_NAME}</strong></span></Link>
}

export function PublicLayout() {
  const [open, setOpen] = useState(false); const { t } = useI18n(); const location = useLocation()
  return <div className={styles.publicLayout}><header className={styles.publicHeader}><BrandMark /><button className={styles.menuButton} aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button><nav className={`${styles.publicNav} ${open ? styles.navOpen : ''}`}><NavLink to="/" end onClick={() => setOpen(false)}>Home</NavLink><NavLink to="/about" onClick={() => setOpen(false)}>{t.about}</NavLink><NavLink to="/how-it-works" onClick={() => setOpen(false)}>How it works</NavLink><NavLink to="/contact" onClick={() => setOpen(false)}>{t.contact}</NavLink><span className={styles.navDivider} /><LanguageToggle /><Link to="/login" onClick={() => setOpen(false)}>{t.login}</Link><Button onClick={() => setOpen(false)}><Link className={styles.buttonLink} to="/register">{t.begin}</Link></Button></nav></header><AnimatePresence mode="wait"><motion.div key={location.pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: .22 }}><Outlet /></motion.div></AnimatePresence><footer className={styles.footer}><Kolam className={styles.footerKolam} /><BrandMark /><Thread /><div className={styles.footerBottom}><span>© {new Date().getFullYear()} {BRAND_NAME}</span><span>Made with care for Tamil families.</span><span><Link to="/privacy">Privacy</Link> · <Link to="/terms">Terms</Link></span></div></footer></div>
}
