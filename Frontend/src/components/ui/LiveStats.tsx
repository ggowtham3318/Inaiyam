import { useQuery } from '@tanstack/react-query'
import { UsersRound } from 'lucide-react'
import { fetchPublicStats } from '../../lib/publicData'
import styles from './ui.module.css'

const minimumCount = Number(import.meta.env.VITE_STATS_MIN_COUNT ?? 100)

export function LiveStats() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-stats'],
    queryFn: fetchPublicStats,
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  })

  if (isLoading || isError || !data || data.approved_profiles < minimumCount) return null
  return <div className={styles.liveStats} aria-label="Live approved profile count"><UsersRound size={19} /><strong>{data.approved_profiles.toLocaleString()}</strong><span>approved profiles</span></div>
}
