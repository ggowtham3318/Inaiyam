import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Heart, Search, Sparkles, UserRound } from 'lucide-react'
import { useAuth } from '../app/AuthContext'
import { BRAND_NAME } from '../app/branding'
import { Card, Button, EmptyState, Skeleton } from '../components/ui'
import { getOwnProfile, requireSupabase } from '../lib/userData'
import styles from './app-pages.module.css'

export function UserDashboard() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null)
  const [counts, setCounts] = useState({ saved: 0, received: 0, sent: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!user) return
    const client = requireSupabase()
    void Promise.all([
      getOwnProfile(user.id),
      client.from('shortlists').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      client.from('interests').select('id', { count: 'exact', head: true }).eq('receiver_user_id', user.id),
      client.from('interests').select('id', { count: 'exact', head: true }).eq('sender_user_id', user.id),
    ]).then(([ownProfile, saved, received, sent]) => {
      const queryError = [saved.error, received.error, sent.error].find(Boolean)
      if (queryError) throw queryError
      setProfile(ownProfile as Record<string, unknown> | null)
      setCounts({ saved: saved.count ?? 0, received: received.count ?? 0, sent: sent.count ?? 0 })
    }).catch(cause => setError(cause instanceof Error ? cause.message : 'Unable to load your dashboard.')).finally(() => setLoading(false))
  }, [user])
  if (loading) return <section><Skeleton height={38} width="60%" /><Skeleton height={22} width="45%" /><div className={styles.cards}>{[1, 2, 3].map(item => <Card key={item}><Skeleton height={32} /><Skeleton height={80} /></Card>)}</div></section>
  if (error) return <section><span className={styles.eyebrow}>Your private space</span><h1>Welcome to {BRAND_NAME}</h1><Card className={styles.dashboardError}><p role="alert">{error}</p></Card></section>
  const fields = ['display_name', 'date_of_birth', 'city', 'state', 'occupation', 'about_me'].filter(field => profile?.[field]).length
  const completion = Math.round((fields / 6) * 100)
  const status = String(profile?.status || 'draft')
  return <section><div className={styles.dashboardHeading}><div><span className={styles.eyebrow}>Your private space</span><h1>Welcome to {BRAND_NAME}</h1><p className={styles.lead}>Take one thoughtful step at a time toward a meaningful introduction.</p></div><span className={`${styles.statusPill} ${styles[`status${status}`]}`}>{status.replace('_', ' ')}</span></div><div className={styles.dashboardGrid}><Card className={styles.nextAction}><div className={styles.cardIcon}><Sparkles /></div><div><span className={styles.cardKicker}>Your next step</span><h2>{completion < 100 ? 'Complete your profile' : 'Explore thoughtful matches'}</h2><p>{completion < 100 ? `${completion}% complete. Add the details that help families understand your story.` : 'Your profile is ready. Discover people whose values and plans feel aligned.'}</p><Button><Link className={styles.buttonLink} to={completion < 100 ? '/app/profile' : '/app/search'}>{completion < 100 ? 'Continue profile' : 'Explore matches'}</Link></Button></div><div className={styles.progress}><strong>{completion}%</strong><div><i style={{ width: `${completion}%` }} /></div></div></Card><div className={styles.statCards}><Card><Heart className={styles.icon} /><strong>{counts.saved}</strong><span>Saved profiles</span><Link to="/app/shortlist">View shortlist</Link></Card><Card><UserRound className={styles.icon} /><strong>{counts.received}</strong><span>Received interests</span><Link to="/app/interests">Review interests</Link></Card><Card><Search className={styles.icon} /><strong>{counts.sent}</strong><span>Sent interests</span><Link to="/app/interests">See activity</Link></Card></div></div></section>
}
export function AppPlaceholder({ title }: { title: string }) { return <section><span className={styles.eyebrow}>{BRAND_NAME}</span><h1>{title}</h1><Card><EmptyState title="This space is ready for your story"><p>The next step will connect this screen to the existing Supabase data and RLS policies.</p></EmptyState></Card></section> }
export function AdminPlaceholder({ title }: { title: string }) { return <section className={styles.adminPage}><span className={styles.eyebrow}>Staff area</span><h1>{title}</h1><Card><EmptyState title="Admin module ready"><p>This protected route is wired to the existing staff role check.</p></EmptyState></Card></section> }
