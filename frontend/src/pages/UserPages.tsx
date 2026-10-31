import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, CheckCircle2, Heart, MapPin, Send, SlidersHorizontal, UserRound, Upload, X } from 'lucide-react'
import { useAuth } from '../app/AuthContext'
import { Button, Card, EmptyState, Input, Modal, Select, Skeleton, Toast } from '../components/ui'
import { getOwnProfile, getPhotoPreviewUrl, getProfileDetail, requireSupabase, searchProfiles, type Interest, type ProfileCursor, type PublicProfile } from '../lib/userData'
import styles from './user-pages.module.css'

function DataState({ loading, error, children }: { loading: boolean; error: string; children: React.ReactNode }) {
  if (loading) return <div className={styles.loadingGrid}><Skeleton height={160} /><Skeleton height={160} /><Skeleton height={160} /></div>
  if (error) return <Card><p className={styles.error} role="alert">{error}</p></Card>
  return <>{children}</>
}

function ProfileCard({ profile, shortlisted, onShortlist }: { profile: PublicProfile; shortlisted?: boolean; onShortlist?: () => void }) {
  return <Card className={styles.profileCard}><div className={styles.profileImage}><ProfilePhoto profileId={profile.id} /></div><div className={styles.profileCardBody}><div className={styles.cardTitle}><div><h3>{profile.display_name || 'Inaiyam member'}{profile.email_verified && profile.phone_verified && <span className={styles.verifiedTick} title="Email and phone verified" aria-label="Email and phone verified"><CheckCircle2 size={17} /></span>}</h3>{profile.age && <span>{profile.age} years</span>}</div>{onShortlist && <button className={styles.iconButton} aria-label={shortlisted ? 'Remove from shortlist' : 'Add to shortlist'} onClick={onShortlist}><Heart size={19} fill={shortlisted ? 'currentColor' : 'none'} /></button>}</div><div className={styles.facts}>{profile.city && <span><MapPin size={14} />{profile.city}</span>}{profile.education_name && <span>{profile.education_name}</span>}{profile.occupation && <span>{profile.occupation}</span>}</div><div className={styles.profileActions}><Link className={styles.viewLink} to={`/app/profile/${profile.id}`}>View profile <ArrowLeft size={15} className={styles.arrow} /></Link><Link className={styles.interestLink} to={`/app/profile/${profile.id}`}>Send interest</Link></div></div></Card>
}

function ProfilePhoto({ profileId }: { profileId: string }) {
  const [photoUrl, setPhotoUrl] = useState('')
  useEffect(() => {
    let active = true
    void Promise.resolve(requireSupabase().rpc('get_profile_photos', { p_profile_id: profileId })).then(async ({ data, error }) => {
      if (error || !data?.length) return
      const photo = data[0] as { storage_bucket: string; storage_path: string }
      const url = await getPhotoPreviewUrl(photo.storage_bucket, photo.storage_path)
      if (active) setPhotoUrl(url)
    }).catch(() => undefined)
    return () => { active = false }
  }, [profileId])
  return photoUrl ? <img src={photoUrl} alt="Profile" /> : <UserRound size={42} aria-label="No profile photo" />
}

function getProfileSearchError(cause: unknown) {
  const error = cause as { code?: string; message?: string } | null
  if (error?.message?.includes('APPROVED_PROFILE_REQUIRED')) {
    return 'Your own profile must be approved before you can search. Complete your profile and submit it for review, or sign in with one of the approved local demo accounts.'
  }
  if (error?.message?.includes('AUTH_REQUIRED')) {
    return 'Sign in to an approved profile before searching for matches.'
  }
  return cause instanceof Error ? cause.message : 'We could not load profiles right now.'
}

export function SearchPage() {
  const [searchParams] = useSearchParams()
  const [profiles, setProfiles] = useState<PublicProfile[]>([]); const [shortlisted, setShortlisted] = useState<Set<string>>(new Set()); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [toast, setToast] = useState(''); const [page, setPage] = useState(0); const [hasMore, setHasMore] = useState(false); const [cursors, setCursors] = useState<(ProfileCursor | undefined)[]>([undefined])
  const { register, handleSubmit, watch } = useForm({ defaultValues: { gender: '', ageMin: searchParams.get('ageMin') ?? '', ageMax: searchParams.get('ageMax') ?? '', city: searchParams.get('city') ?? '', state: '' } })
  const filters = watch()
  async function load(nextPage = 0) {
    setLoading(true); setError('')
    try {
      const pageCursor = nextPage === 0 ? undefined : cursors[nextPage]
      const result = await searchProfiles({ ...filters, ageMin: filters.ageMin ? Number(filters.ageMin) : undefined, ageMax: filters.ageMax ? Number(filters.ageMax) : undefined, cursor: pageCursor, limit: 21 })
      const nextProfiles = result.slice(0, 20)
      setProfiles(nextProfiles)
      setPage(nextPage)
      setHasMore(result.length > 20)
      setCursors(current => {
        const updated = current.slice(0, nextPage + 1)
        const last = nextProfiles[nextProfiles.length - 1]
        if (last) updated[nextPage + 1] = { created_at: last.created_at, id: last.id }
        return updated
      })
    }
    catch (cause) { setError(getProfileSearchError(cause)) }
    finally { setLoading(false) }
  }
  // Load only on mount; filter changes are submitted explicitly by the user.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(0) }, [])
  useEffect(() => {
    const user = requireSupabase().auth.getUser()
    let active = true
    void user.then(async ({ data: authData }) => {
      if (!authData.user) return
      const { data, error: listError } = await requireSupabase().from('shortlists').select('shortlisted_profile_id').eq('user_id', authData.user.id)
      if (!active) return
      if (listError) setToast('Could not load your saved profiles.')
      else setShortlisted(new Set((data ?? []).map(row => row.shortlisted_profile_id)))
    })
    return () => { active = false }
  }, [])
  async function toggleShortlist(profileId: string) {
    try {
      const { data, error: rpcError } = await requireSupabase().rpc('toggle_shortlist', { p_profile_id: profileId })
      if (rpcError) throw rpcError
      setShortlisted(current => {
        const next = new Set(current)
        if (data) {
          next.add(profileId)
        } else {
          next.delete(profileId)
        }
        return next
      })
    } catch { setToast('Could not update your shortlist. Please try again.') }
  }
  return <section><div className={styles.pageHeading}><div><span className={styles.eyebrow}>Discover thoughtfully</span><h1>Explore matches</h1><p>Use a few filters, then take your time with each profile.</p></div><Button variant="secondary" icon={<SlidersHorizontal size={16} />}>Filters</Button></div><Card className={styles.filterCard}><form className={styles.filters} onSubmit={handleSubmit(() => void load())}><Select label="Gender" {...register('gender')}><option value="">Everyone</option><option value="female">Women</option><option value="male">Men</option><option value="other">Other</option></Select><Input label="Age from" type="number" min="18" max="100" {...register('ageMin')} /><Input label="Age to" type="number" min="18" max="100" {...register('ageMax')} /><Input label="City" placeholder="Chennai" {...register('city')} /><Input label="State" placeholder="Tamil Nadu" {...register('state')} /><Button type="submit">Search</Button></form></Card><DataState loading={loading} error={error}>{profiles.length === 0 ? <Card><EmptyState title="No profiles found"><p>Try widening your search and discover a new possibility.</p></EmptyState></Card> : <><div className={styles.profileGrid}>{profiles.map(profile => <ProfileCard key={profile.id} profile={profile} shortlisted={shortlisted.has(profile.id)} onShortlist={() => void toggleShortlist(profile.id)} />)}</div><div className={styles.pageActions}><Button variant="secondary" disabled={page === 0} onClick={() => void load(page - 1)}>Previous</Button><span>Page {page + 1}</span><Button variant="secondary" disabled={!hasMore} onClick={() => void load(page + 1)}>Next</Button></div></>}</DataState>{toast && <Toast message={toast} onClose={() => setToast('')} />}</section>
}

const profileSchema = z.object({
  display_name: z.string().trim().min(2, 'Tell us the name families should see.').max(120),
  mobile_number: z.string().optional().refine(value => !value || /^[6-9]\d{9}$/.test(value), 'Enter a valid 10-digit Indian mobile number.'),
  full_address: z.string().trim().min(10, 'Enter your full address.').max(1000, 'Address must be 1,000 characters or fewer.'),
  date_of_birth: z.string().refine(value => {
    const date = new Date(`${value}T00:00:00`)
    const today = new Date()
    const age = today.getFullYear() - date.getFullYear() - (today < new Date(today.getFullYear(), date.getMonth(), date.getDate()) ? 1 : 0)
    return Boolean(value) && !Number.isNaN(date.getTime()) && age >= 18 && age <= 100
  }, 'Enter a valid date for someone aged 18 or over.'),
  gender: z.enum(['male', 'female', 'other']),
  marital_status_id: z.string().min(1, 'Choose your marital status.'),
  city: z.string().trim().min(2, 'Add your city.').max(120),
  state: z.string().trim().min(2, 'Add your state.').max(120),
  country: z.string().trim().min(2).max(120),
  occupation: z.string().trim().min(2, 'Tell us what you do.').max(160),
  about_me: z.string().trim().min(30, 'Write at least 30 characters so families can understand you.').max(5000),
  partner_preferences: z.string().trim().min(10, 'Tell us a little about the partner you hope to meet.').max(3000),
})
type ProfileForm = z.infer<typeof profileSchema>
type Lookup = { id: string; code: string; name: string }
const indiaStatesAndTerritories = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh',
  'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland',
  'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir',
  'Ladakh', 'Lakshadweep', 'Puducherry',
]
const maritalStatusLabels: Record<string, string> = {
  never_married: 'Single',
  divorced: 'Divorced',
  separated: 'Separated',
  widowed: 'Widowed',
}
export function MyProfilePage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [notice, setNotice] = useState('')
  const [maritalStatuses, setMaritalStatuses] = useState<Lookup[]>([]); const [photos, setPhotos] = useState<{ id?: string; path: string; status: string; preview: string }[]>([])
  const { register, control, reset, getValues, getFieldState, watch, trigger, formState: { errors } } = useForm<ProfileForm>({ resolver: zodResolver(profileSchema), defaultValues: { country: 'India', gender: 'other', marital_status_id: '', mobile_number: '', full_address: '', partner_preferences: '' } })
  const values = watch()
  const completed = [values.display_name, values.date_of_birth, values.gender, values.marital_status_id, values.city, values.state, values.full_address, values.occupation, values.about_me, values.partner_preferences].filter(Boolean).length
  const completion = Math.round((completed / 10) * 100)

  useEffect(() => {
    if (!user) return
    const client = requireSupabase()
    void Promise.all([
      getOwnProfile(user.id),
      client.from('lookup_marital_statuses').select('id,code,name').eq('is_active', true),
    ]).then(async ([data, lookupResult]) => {
      if (lookupResult.error) throw lookupResult.error
      const statuses = (lookupResult.data ?? []) as Lookup[]
      setMaritalStatuses(statuses
        .map(item => ({ ...item, name: maritalStatusLabels[item.code] ?? item.name }))
        .sort((left, right) => {
          const leftOrder = Object.keys(maritalStatusLabels).indexOf(left.code)
          const rightOrder = Object.keys(maritalStatusLabels).indexOf(right.code)
          return (leftOrder < 0 ? Number.MAX_SAFE_INTEGER : leftOrder) - (rightOrder < 0 ? Number.MAX_SAFE_INTEGER : rightOrder)
        }))
      if (data) {
        setProfile(data as Record<string, unknown>)
        const { data: preference } = await client.from('partner_preferences').select('additional_preferences').eq('profile_id', data.id).maybeSingle()
        const description = preference?.additional_preferences && typeof preference.additional_preferences === 'object' && 'description' in preference.additional_preferences ? String(preference.additional_preferences.description) : ''
        reset({
          ...data,
          display_name: data.display_name ?? '',
          date_of_birth: data.date_of_birth ?? '',
          mobile_number: String(data.mobile_number ?? '').replace(/^\+91/, ''),
          full_address: data.full_address ?? '',
          gender: data.gender ?? 'other',
          marital_status_id: data.marital_status_id ?? '',
          country: data.country ?? 'India',
          partner_preferences: description,
        } as ProfileForm)
      }
      if (data?.id) {
        const { data: existingPhotos, error: photoError } = await client.from('profile_photos').select('id,storage_path,status,storage_bucket').eq('profile_id', data.id).order('created_at')
        if (photoError) throw photoError
        const ownerPhotos = existingPhotos ?? []
        const photoPreviews = await Promise.all(ownerPhotos.map(async photo => ({
          id: photo.id,
          path: photo.storage_path,
          status: photo.status,
          preview: photo.status === 'rejected' ? '' : await getPhotoPreviewUrl(photo.storage_bucket, photo.storage_path),
        })))
        setPhotos(photoPreviews)
      }
    }).catch(cause => setError(cause instanceof Error ? cause.message : 'Unable to load your profile.')).finally(() => setLoading(false))
  }, [reset, user])

  async function saveDraft(valuesToSave = getValues()) {
    if (!user) return null
    const client = requireSupabase()
    const { data, error: saveError } = await client.from('profiles').update({
      display_name: valuesToSave.display_name, date_of_birth: valuesToSave.date_of_birth || null, gender: valuesToSave.gender,
      mobile_number: valuesToSave.mobile_number ? `+91${valuesToSave.mobile_number}` : null,
      full_address: valuesToSave.full_address,
      marital_status_id: valuesToSave.marital_status_id || null, city: valuesToSave.city, state: valuesToSave.state,
      country: valuesToSave.country, occupation: valuesToSave.occupation, about_me: valuesToSave.about_me,
    }).eq('user_id', user.id).select().single()
    if (saveError) throw saveError
    if (data) setProfile(data)
    if (data?.id) {
      const { error: preferenceError } = await client.from('partner_preferences').upsert({ profile_id: data.id, additional_preferences: { description: valuesToSave.partner_preferences } })
      if (preferenceError) throw preferenceError
    }
    return data
  }
  async function save() {
    setError(''); setNotice('')
    if (!await trigger('mobile_number')) return
    try { await saveDraft(); setNotice('Your draft has been saved.') } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save your draft.') }
  }
  async function submitForReview() {
    setError(''); setNotice('')
    const valid = await trigger()
    if (!valid) {
      const fields: { name: keyof ProfileForm; label: string }[] = [
        { name: 'display_name', label: 'Display name' },
        { name: 'full_address', label: 'Full address' },
        { name: 'date_of_birth', label: 'Date of birth' },
        { name: 'gender', label: 'Gender' },
        { name: 'marital_status_id', label: 'Marital status' },
        { name: 'city', label: 'City' },
        { name: 'state', label: 'State' },
        { name: 'country', label: 'Country' },
        { name: 'occupation', label: 'Occupation' },
        { name: 'about_me', label: 'Short introduction' },
        { name: 'partner_preferences', label: 'Partner preferences' },
      ]
      const messages = fields
        .map(field => {
          const message = getFieldState(field.name).error?.message
          return message ? `${field.label}: ${message}` : null
        })
        .filter((message): message is string => Boolean(message))
      setError(messages.length ? `Please correct these fields: ${messages.join(' ')}` : 'Please check the required fields marked in the form.')
      return
    }
    if (!profile?.id) {
      setError('Your profile record has not loaded. Refresh the page and try again; if this continues, sign out and back in.')
      return
    }
    try {
      const savedProfile = await saveDraft()
      const profileId = savedProfile?.id ?? profile.id
      const { error: submitError } = await requireSupabase().rpc('submit_profile_for_review', { p_profile_id: profileId })
      if (submitError) throw submitError
      setProfile(current => current ? { ...current, status: 'pending_review', rejection_reason: null } : current)
      setNotice('Your profile is now awaiting review.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to submit your profile.') }
  }
  async function uploadPhoto(file: File) {
    if (!user || !profile?.id) { setError('Save your profile before adding photos.'); return }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { setError('Choose a JPG, PNG or WEBP image no larger than 5 MB.'); return }
    const path = `${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`
    let uploaded = false
    try {
      const client = requireSupabase(); const upload = await client.storage.from('photos-approved').upload(path, file, { upsert: false })
      if (upload.error) throw upload.error
      uploaded = true
      const { data, error: photoError } = await client.rpc('add_profile_photo', { p_profile_id: profile.id, p_storage_path: path, p_is_primary: photos.length === 0, p_is_blurred: false, p_is_private: false })
      if (photoError) throw photoError
      setPhotos(current => [...current, { id: data.id, path, status: 'approved', preview: URL.createObjectURL(file) }]); setNotice('Photo uploaded and added to your profile.')
    } catch (cause) {
      if (uploaded) await requireSupabase().storage.from('photos-approved').remove([path])
      setError(cause instanceof Error ? cause.message : 'Unable to upload this photo.')
    }
  }
  async function removePhoto(photo: { id?: string; path: string; status?: string; preview?: string }) {
    if (!photo.id) {
      if (photo.preview?.startsWith('blob:')) URL.revokeObjectURL(photo.preview)
      setPhotos(current => current.filter(item => item.path !== photo.path))
      return
    }
    try {
      const client = requireSupabase()
      const bucket = photo.status === 'approved' ? 'photos-approved' : 'photos-pending'
      const { error: storageError } = await client.storage.from(bucket).remove([photo.path])
      if (storageError) throw storageError
      const { error: removeError } = await client.rpc('remove_profile_photo', { p_photo_id: photo.id })
      if (removeError) throw removeError
      if (photo.preview?.startsWith('blob:')) URL.revokeObjectURL(photo.preview)
      setPhotos(current => current.filter(item => item.path !== photo.path)); setNotice('Photo removed.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to remove this photo.') }
  }
  if (loading) return <DataState loading error="">{null}</DataState>
  const status = String(profile?.status || 'draft')
  return <section>
    <div className={styles.profileHeader}>
      <div><span className={styles.eyebrow}>Your story</span><h1>Create your profile</h1><p className={styles.lead}>Complete your details in one form. You can save a draft and return later; nothing is published before review.</p></div>
      <div className={styles.completion}><strong>{completion}%</strong><span>complete</span><div><i style={{ width: `${completion}%` }} /></div></div>
    </div>
    <Card className={styles.formCard}>
      <div className={styles.statusRow}><span>Status: <strong>{status.replace('_', ' ')}</strong></span>{status === 'approved' && <span className={styles.verified}><CheckCircle2 size={16} /> Verified</span>}</div>
      {status === 'rejected' && <p className={styles.rejection} role="alert"><strong>Changes requested:</strong> {String(profile?.rejection_reason || 'Please update your profile and resubmit.')}</p>}
      <form className={styles.profileForm} onSubmit={event => { event.preventDefault(); void save() }}>
        <section className={styles.profileSection}>
          <h2>Basic information</h2>
          <div className={styles.twoCol}>
            <Input label="Display name" error={errors.display_name?.message} {...register('display_name')} />
            <Input label="Date of birth" type="date" error={errors.date_of_birth?.message} {...register('date_of_birth')} />
            <div className={styles.emailField}><Input label="Email address" type="email" value={user?.email ?? ''} readOnly />{user?.email_confirmed_at && <span className={styles.verifiedTick} title="Email verified" aria-label="Email verified"><CheckCircle2 size={17} /></span>}</div>
            <Input label="Mobile number" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} pattern="[0-9]{10}" error={errors.mobile_number?.message} {...register('mobile_number', { onChange: event => { event.target.value = event.target.value.replace(/\D/g, '').slice(0, 10) } })} />
            <div><Select label="Profile gender" {...register('gender')}><option value="other">Prefer to describe later</option><option value="female">Woman</option><option value="male">Man</option></Select>{errors.gender && <small className={styles.error}>{errors.gender.message}</small>}</div>
            <div><Controller control={control} name="marital_status_id" render={({ field }) => <Select label="Marital status" name={field.name} value={field.value ?? ''} onBlur={field.onBlur} onChange={field.onChange} ref={field.ref}><option value="">Choose one</option>{maritalStatuses.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</Select>} />{!maritalStatuses.length && <small className={styles.error}>No options are available yet. Apply the latest Supabase migrations and reload.</small>}{errors.marital_status_id && <small className={styles.error}>{errors.marital_status_id.message}</small>}</div>
          </div>
        </section>
        <section className={styles.profileSection}>
          <h2>Location and work</h2>
          <div className={styles.twoCol}>
            <Input label="City" error={errors.city?.message} {...register('city')} />
            <div><Select label="State / Union Territory" {...register('state')}><option value="">Choose a state or union territory</option>{indiaStatesAndTerritories.map(stateName => <option value={stateName} key={stateName}>{stateName}</option>)}</Select>{errors.state && <small className={styles.error}>{errors.state.message}</small>}</div>
            <Input label="Country" error={errors.country?.message} {...register('country')} />
            <Input label="Occupation" error={errors.occupation?.message} {...register('occupation')} />
          </div>
          <label className={styles.textareaLabel}>Full address<textarea rows={3} aria-invalid={Boolean(errors.full_address)} {...register('full_address')} />{errors.full_address && <span className={styles.error}>{errors.full_address.message}</span>}</label>
        </section>
        <section className={styles.profileSection}>
          <h2>About you</h2>
          <label className={styles.textareaLabel}>Short introduction<textarea rows={6} placeholder="Share your values, interests and hopes." aria-invalid={Boolean(errors.about_me)} {...register('about_me')} />{errors.about_me && <span className={styles.error}>{errors.about_me.message}</span>}</label>
        </section>
        <section className={styles.profileSection}>
          <h2>Partner preferences</h2>
          <label className={styles.textareaLabel}>What are you looking for in a partner?<textarea rows={6} placeholder="Share the values, location or lifestyle preferences that matter to you." aria-invalid={Boolean(errors.partner_preferences)} {...register('partner_preferences')} />{errors.partner_preferences && <span className={styles.error}>{errors.partner_preferences.message}</span>}</label>
        </section>
        <section className={`${styles.profileSection} ${styles.photoStep}`}>
          <h2>Profile photo</h2><div className={styles.primaryPhoto}>{photos.find(photo => photo.status === "approved")?.preview ? <img src={photos.find(photo => photo.status === "approved")?.preview} alt="Your profile photo" /> : <UserRound size={48} aria-label="Add a photo of yourself" />}</div>
          <div className={styles.photoIntro}><Upload size={22} /><div><h3>Add a photo</h3><p>Your photo appears on your profile as soon as it is uploaded.</p></div></div>
          <label className={styles.uploadBox}><Upload size={22} /><span>Choose a photo</span><small>JPG, PNG or WEBP · up to 5 MB</small><input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { const file = event.target.files?.[0]; if (file) void uploadPhoto(file); event.currentTarget.value = '' }} /></label>
          <div className={styles.photoGrid}>{photos.map(photo => <div className={styles.photoItem} key={photo.id || photo.path}>{photo.preview ? <img src={photo.preview} alt="Your profile upload" /> : <div className={styles.photoUnavailable}>Preview unavailable</div>}<span>{photo.status === 'approved' ? 'On profile' : photo.status}</span><button type="button" aria-label="Remove photo" onClick={() => void removePhoto(photo)}><X size={15} /></button></div>)}</div>
        </section>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {notice && <p className={styles.success} role="status">{notice}</p>}
        <div className={styles.formActions}>
          <Button type="submit" variant="secondary">Save draft</Button>
          {(status === 'draft' || status === 'rejected') && <Button type="button" onClick={() => void submitForReview()}>Submit profile for review</Button>}
        </div>
      </form>
    </Card>
  </section>
}

export function ProfileDetailPage() {
  const { profileId } = useParams(); const navigate = useNavigate(); const [profile, setProfile] = useState<PublicProfile | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [actionError, setActionError] = useState(''); const [notice, setNotice] = useState(''); const [message, setMessage] = useState(''); const [modalOpen, setModalOpen] = useState(false); const [safetyAction, setSafetyAction] = useState<'report' | 'block' | null>(null); const [reportCategory, setReportCategory] = useState('fake_profile'); const [reportDescription, setReportDescription] = useState(''); const [blockReason, setBlockReason] = useState('Safety concern'); const [safetyBusy, setSafetyBusy] = useState(false)
  useEffect(() => { if (!profileId) return; void getProfileDetail(profileId).then(setProfile).catch(cause => setError(cause instanceof Error ? cause.message : 'Unable to load this profile.')).finally(() => setLoading(false)) }, [profileId])
  async function sendInterest() {
    if (!profile) return
    setActionError('')
    try {
      const { error: rpcError } = await requireSupabase().rpc('send_interest', { p_receiver_profile_id: profile.id, p_message: message || null })
      if (rpcError) throw rpcError
      navigate('/app/interests?tab=sent')
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Unable to send this interest.') }
  }
  async function shortlist() {
    if (!profile) return
    setActionError('')
    try {
      const { data, error: rpcError } = await requireSupabase().rpc('toggle_shortlist', { p_profile_id: profile.id })
      if (rpcError) throw rpcError
      setNotice(data ? 'Added to your shortlist.' : 'Removed from your shortlist.')
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Unable to update your shortlist.') }
  }
  async function submitSafetyAction() {
    if (!profile || !safetyAction) return
    setSafetyBusy(true); setActionError('')
    try {
      const client = requireSupabase()
      if (safetyAction === 'report') {
        const { error: rpcError } = await client.rpc('report_profile', { p_profile_id: profile.id, p_category: reportCategory, p_description: reportDescription.trim() })
        if (rpcError) throw rpcError
        setNotice('Thank you. Your report has been sent to our team for review.')
      } else {
        const { error: rpcError } = await client.rpc('block_profile', { p_profile_id: profile.id, p_reason: blockReason })
        if (rpcError) throw rpcError
        navigate('/app/search', { replace: true })
      }
      setSafetyAction(null); setReportDescription('')
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : `Unable to ${safetyAction} this profile.`) }
    finally { setSafetyBusy(false) }
  }
  const canSubmitReport = reportDescription.trim().length >= 10 && reportDescription.trim().length <= 1000
  const safetyTitle = safetyAction === 'report' ? 'Report this profile?' : 'Block this profile?'
  return <section><Link className={styles.backLink} to="/app/search"><ArrowLeft size={16} />Back to search</Link><DataState loading={loading} error={error}>{profile && <div className={styles.detailGrid}><div className={styles.detailPhoto}><ProfilePhoto profileId={profile.id} /></div><Card><span className={styles.eyebrow}>Profile</span><h1>{profile.display_name || 'Inaiyam member'}</h1><div className={styles.detailFacts}>{profile.age && <span>{profile.age} years</span>}{profile.city && <span><MapPin size={15} />{profile.city}</span>}{profile.education_name && <span>{profile.education_name}</span>}</div><p>{profile.about_me || 'This member is building their story on Inaiyam Matrimony.'}</p><div className={styles.formActions}><Button icon={<Heart size={16} />} onClick={() => void shortlist()}>Shortlist</Button><Button variant="secondary" icon={<Send size={16} />} onClick={() => setModalOpen(true)}>Send interest</Button></div><div className={styles.safetyActions}><button type="button" onClick={() => { setActionError(''); setSafetyAction('report') }}>Report profile</button><button type="button" onClick={() => { setActionError(''); setSafetyAction('block') }}>Block profile</button></div>{notice && <p className={styles.success} role="status">{notice}</p>}{actionError && <p className={styles.error} role="alert">{actionError}</p>}</Card></div>}</DataState>{modalOpen && <div className={styles.inlineModal}><Card><h2>Send a kind first message</h2><Input label="Optional message" placeholder="A simple hello goes a long way." value={message} onChange={event => setMessage(event.target.value)} /><div className={styles.formActions}><Button onClick={() => void sendInterest()}>Send interest</Button><Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button></div></Card></div>}<Modal title={safetyTitle} open={Boolean(safetyAction)} onClose={() => !safetyBusy && setSafetyAction(null)}><div className={styles.safetyDialog}>{safetyAction === 'report' ? <><p>Choose the closest reason and add enough detail for our team to review it.</p><Select label="Report reason" value={reportCategory} onChange={event => setReportCategory(event.target.value)}><option value="fake_profile">Fake or misleading profile</option><option value="harassment">Harassment</option><option value="scam">Scam or suspicious behavior</option><option value="inappropriate_content">Inappropriate content</option><option value="underage">Underage user</option><option value="other">Other</option></Select><label className={styles.textareaLabel}>Details<textarea rows={4} maxLength={1000} value={reportDescription} onChange={event => setReportDescription(event.target.value)} placeholder="Describe what concerned you (10–1,000 characters)." /></label><small>{reportDescription.trim().length}/1,000 characters</small></> : <><p>Blocking hides each other’s profiles from search and profile details and stops further interactions.</p><Select label="Reason for blocking" value={blockReason} onChange={event => setBlockReason(event.target.value)}><option>Safety concern</option><option>Unwanted contact</option><option>Inappropriate behavior</option><option>Other</option></Select><p className={styles.muted}>You can continue using Inaiyam. This profile will no longer be available to you.</p></>}{actionError && <p className={styles.error} role="alert">{actionError}</p>}<div className={styles.formActions}><Button variant="secondary" onClick={() => setSafetyAction(null)} disabled={safetyBusy}>Cancel</Button><Button onClick={() => void submitSafetyAction()} disabled={safetyBusy || (safetyAction === 'report' && !canSubmitReport)}>{safetyBusy ? 'Submitting…' : safetyAction === 'report' ? 'Send report' : 'Confirm block'}</Button></div></div></Modal></section>
}

export function ShortlistPage() {
  const { user } = useAuth(); const [profiles, setProfiles] = useState<PublicProfile[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('')
  useEffect(() => { if (!user) return; void (async () => { try { const client = requireSupabase(); const { data, error: listError } = await client.from('shortlists').select('shortlisted_profile_id').eq('user_id', user.id); if (listError) throw listError; const rows = await Promise.all((data ?? []).map(row => getProfileDetail(row.shortlisted_profile_id))); setProfiles(rows) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load your shortlist.') } finally { setLoading(false) } })() }, [user])
  async function removeFromShortlist(profileId: string) {
    try {
      const { data, error: toggleError } = await requireSupabase().rpc('toggle_shortlist', { p_profile_id: profileId })
      if (toggleError) throw toggleError
      if (!data) setProfiles(current => current.filter(profile => profile.id !== profileId))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to update your shortlist.') }
  }
  return <section><span className={styles.eyebrow}>Saved with intention</span><h1>Your shortlist</h1><p className={styles.lead}>Keep the profiles you would like to revisit.</p><DataState loading={loading} error={error}>{profiles.length ? <div className={styles.profileGrid}>{profiles.map(profile => <ProfileCard key={profile.id} profile={profile} shortlisted onShortlist={() => void removeFromShortlist(profile.id)} />)}</div> : <Card><EmptyState title="Your shortlist is waiting"><p>When a profile feels worth a second look, save it here.</p><Link to="/app/search">Explore profiles</Link></EmptyState></Card>}</DataState></section>
}

export function InterestsPage() {
  const { user } = useAuth(); const [searchParams, setSearchParams] = useSearchParams(); const initialTab = searchParams.get('tab'); const [interests, setInterests] = useState<Interest[]>([]); const [tab, setTab] = useState<'received' | 'sent' | 'accepted'>(initialTab === 'sent' || initialTab === 'accepted' ? initialTab : 'received'); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [actionError, setActionError] = useState('')
  const load = useCallback(async () => {
    if (!user) return
    try {
      const { data, error: listError } = await requireSupabase().from('interests').select('*').or(`sender_user_id.eq.${user.id},receiver_user_id.eq.${user.id}`).order('created_at', { ascending: false })
      if (listError) throw listError
      setInterests((data ?? []) as Interest[])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load interests.')
    } finally {
      setLoading(false)
    }
  }, [user])
  useEffect(() => { void load() }, [load])
  const visible = useMemo(() => interests.filter(item => tab === 'accepted' ? item.status === 'accepted' : tab === 'received' ? item.receiver_user_id === user?.id : item.sender_user_id === user?.id), [interests, tab, user?.id])
  async function respond(id: string, status: 'accepted' | 'declined') {
    setActionError('')
    try {
      const { error: responseError } = await requireSupabase().rpc('respond_interest', { p_interest_id: id, p_status: status })
      if (responseError) throw responseError
      await load()
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Unable to update this interest.') }
  }
  async function withdraw(id: string) {
    setActionError('')
    try {
      const { error: withdrawError } = await requireSupabase().rpc('withdraw_interest', { p_interest_id: id })
      if (withdrawError) throw withdrawError
      await load()
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Unable to withdraw this interest.') }
  }
  return (
    <section>
      <span className={styles.eyebrow}>Meaningful signals</span>
      <h1>Interests</h1>
      <div className={styles.interestTabs}>
        {(['received', 'sent', 'accepted'] as const).map(item => (
          <button className={tab === item ? styles.activeTab : ''} key={item} onClick={() => { setTab(item); setSearchParams({ tab: item }) }}>
            {item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>
      <DataState loading={loading} error={error}>
        {visible.length ? (
          <div className={styles.interestList}>
            {visible.map(item => (
              <Card key={item.id}>
                <div>
                  <strong>{item.receiver_user_id === user?.id ? 'Someone is interested in you' : 'Interest sent'}</strong>
                  <p>{item.message || 'A new beginning starts with a hello.'}</p>
                  <small>{new Date(item.created_at).toLocaleDateString()}</small>
                </div>
                {item.status === 'pending' && item.receiver_user_id === user?.id && (
                  <div className={styles.formActions}>
                    <Button onClick={() => void respond(item.id, 'accepted')}>Accept</Button>
                    <Button variant="ghost" onClick={() => void respond(item.id, 'declined')}>Decline</Button>
                  </div>
                )}
                {item.status === 'pending' && item.sender_user_id === user?.id && (
                  <Button variant="ghost" onClick={() => void withdraw(item.id)}>Withdraw</Button>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <Card><EmptyState title="No interests in this view"><p>Your thoughtful introductions will appear here.</p></EmptyState></Card>
        )}
      </DataState>
      {actionError && <p className={styles.error} role="alert">{actionError}</p>}
    </section>
  )
}
