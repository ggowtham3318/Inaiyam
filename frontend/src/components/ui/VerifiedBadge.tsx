import { CheckCircle2, Circle } from 'lucide-react'

export function VerifiedBadge({ verified, label }: { verified: boolean; label: string }) {
  return <span className={verified ? 'verifiedBadge' : 'unverifiedBadge'}>{verified ? <CheckCircle2 size={16} aria-hidden="true" /> : <Circle size={15} aria-hidden="true" />} {label}{verified ? ' verified' : ' · Not verified'}</span>
}
