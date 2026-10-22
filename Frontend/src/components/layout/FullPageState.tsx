import { Skeleton } from '../ui'
import styles from './layout.module.css'

export function FullPageState({ label }: { label: string }) {
  return <main className={styles.fullPage}><Skeleton width="180px" height={18} /><p>{label}</p></main>
}
