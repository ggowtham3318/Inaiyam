import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, ClipboardCheck, EyeOff, Heart, HeartHandshake, Search, ShieldCheck, Sparkles, UsersRound } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { BRAND_NAME } from '../app/branding'
import { Button, Card, Kolam, Thread } from '../components/ui'
import { fetchPublishedStories } from '../lib/publicData'
import styles from './public-pages.module.css'
import { useI18n } from '../app/I18nContext'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Input } from '../components/ui'
import { requireSupabase } from '../lib/userData'

export function Home() {
  const { t } = useI18n()
  const { data: stories = [] } = useQuery({ queryKey: ['published-stories'], queryFn: fetchPublishedStories, staleTime: 5 * 60 * 1000 })
  return <main><section className={styles.hero}><Kolam className={styles.heroKolam} /><div className={styles.heroCopy}><span className={styles.eyebrow}>{BRAND_NAME} · இணையம்</span><h1>{t.heroTitle}</h1><p>{t.heroBody}</p><div className={styles.actions}><Button><Link className={styles.buttonLink} to="/register">Create profile <ArrowRight size={16} /></Link></Button><Button variant="secondary"><Link className={styles.outlineLink} to="/app/search">Explore matches</Link></Button></div></div><div className={styles.heroIllustration}><svg role="img" aria-label="Tamil wedding kolam illustration" viewBox="0 0 260 260"><path d="M130 28v204M28 130h204M58 58l144 144M202 58 58 202M72 130c0-32 26-58 58-58s58 26 58 58-26 58-58 58-58-26-58-58Z" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="130" cy="130" r="10" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="130" cy="28" r="4" fill="currentColor" /><circle cx="232" cy="130" r="4" fill="currentColor" /><circle cx="130" cy="232" r="4" fill="currentColor" /><circle cx="28" cy="130" r="4" fill="currentColor" /></svg><Thread /></div><form className={styles.heroSearch} method="get" action="/app/search"><span className={styles.eyebrow}>Start with what matters</span><h2>Find a connection that feels right.</h2><div className={styles.searchFields}><label>Age from<select name="ageMin" defaultValue="24"><option value="21">21</option><option value="24">24</option><option value="28">28</option><option value="32">32</option></select></label><label>Age to<select name="ageMax" defaultValue="35"><option value="30">30</option><option value="35">35</option><option value="40">40</option><option value="45">45</option></select></label><label>City<input name="city" placeholder="Chennai, Coimbatore..." /></label><Button type="submit" icon={<Search size={16} />}>Browse profiles</Button></div></form></section><section className={styles.trustStrip} aria-label="How Inaiyam protects members"><div><ClipboardCheck /><span>Profiles can be submitted for review</span></div><div><CheckCircle2 /><span>Photos appear on your profile after upload</span></div><div><EyeOff /><span>Contact details stay private</span></div><div><HeartHandshake /><span>Start with a free profile</span></div></section>{stories.length > 0 && <section className={styles.content}><div className={styles.sectionHeading}><span className={styles.eyebrow}>From the Inaiyam community</span><h2>Stories shared by families.</h2></div><div className={styles.storyGrid}>{stories.map(story => <Card key={story.id}><h3>{story.title}</h3><p>{story.story}</p></Card>)}</div></section>}<section className={styles.content}><div className={styles.sectionHeading}><span className={styles.eyebrow}>Our promise</span><h2>A beginning that feels like home.</h2></div><div className={styles.features}><Card><Heart className={styles.featureIcon} /><h3>Intentional introductions</h3><p>Search by the values and life details that matter to your family.</p></Card><Card><ShieldCheck className={styles.featureIcon} /><h3>Built on trust</h3><p>Privacy-first profiles, verified details and respectful communication.</p></Card><Card><UsersRound className={styles.featureIcon} /><h3>Family in mind</h3><p>Because a partnership brings two families together, not just two people.</p></Card></div></section><section className={styles.stepsSection}><div className={styles.sectionHeading}><span className={styles.eyebrow}>How it works · எப்படி</span><h2>Simple steps. Meaningful beginnings.</h2></div><div className={styles.steps}><div><span>01</span><Sparkles /><h3>Create your story</h3><p>Share the details that help a family see the person behind the profile.</p></div><div><span>02</span><Search /><h3>Explore thoughtfully</h3><p>Discover approved profiles with filters built around real-life priorities.</p></div><div><span>03</span><Heart /><h3>Begin with respect</h3><p>Send an interest when a profile feels like a conversation worth beginning.</p></div></div></section></main>
}

export function SimplePublicPage({ title, tamil, children, variant = 'default' }: { title: string; tamil: string; children: string; variant?: 'default' | 'stories' | 'contact' }) {
  const { data: stories = [] } = useQuery({ queryKey: ['published-stories'], queryFn: fetchPublishedStories, enabled: variant === 'stories', staleTime: 5 * 60 * 1000 })
  return <main className={`${styles.simplePage} ${styles[variant]}`}><span className={styles.eyebrow}>{tamil}</span><h1>{title}</h1><Thread /><p>{children}</p>{variant === 'stories' && stories.length > 0 && <div className={styles.quoteGrid}>{stories.map(story => <Card key={story.id}><p>{story.story}</p><strong>{story.title}</strong></Card>)}</div>}{variant === 'contact' && <><div className={styles.contactGrid}><Card><h3>Say vanakkam</h3><p>hello@inaiyammatrimony.com</p><p>Monday – Saturday<br />10:00 AM – 6:00 PM IST</p></Card><Card><h3>For families</h3><p>We can help with profile questions, privacy and getting started.</p></Card></div><ContactForm /></>}<Button><Link className={styles.buttonLink} to="/register">Start with {BRAND_NAME}</Link></Button></main>
}

const contactSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name.').max(120, 'Name must be 120 characters or fewer.'),
  email: z.string().trim().email('Enter a valid email address.').max(320, 'Email must be 320 characters or fewer.'),
  message: z.string().trim().min(1, 'Enter a message.').max(5000, 'Message must be 5,000 characters or fewer.'),
})
type ContactValues = z.infer<typeof contactSchema>

function ContactForm() {
  const [serverError, setServerError] = useState('')
  const [sent, setSent] = useState(false)
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ContactValues>({ resolver: zodResolver(contactSchema) })
  async function submit(values: ContactValues) {
    setServerError('')
    try {
      const { error } = await requireSupabase().from('contact_messages').insert(values)
      if (error) throw error
      reset(); setSent(true)
    } catch (cause) {
      const code = (cause as { code?: string; status?: number }).code
      const status = (cause as { status?: number }).status
      setServerError(code === 'over_request_rate_limit' || status === 429
        ? 'We have received several requests recently. Please wait a few minutes before trying again.'
        : cause instanceof Error ? cause.message : 'Unable to send your message. Please try again later.')
    }
  }
  return <Card className={styles.contactFormCard}><h2>Send us a message</h2><p>To help prevent duplicate requests, the form is disabled while your message is being sent.</p><form className={styles.contactForm} onSubmit={handleSubmit(submit)} noValidate><Input label="Your name" autoComplete="name" maxLength={120} error={errors.name?.message} {...register('name')} /><Input label="Email address" type="email" autoComplete="email" maxLength={320} error={errors.email?.message} {...register('email')} /><label className={styles.contactField}><span>Message</span><textarea rows={5} maxLength={5000} aria-invalid={Boolean(errors.message)} {...register('message')} />{errors.message?.message && <small role="alert">{errors.message.message}</small>}</label>{serverError && <p className={styles.contactError} role="alert">{serverError}</p>}{sent && <p className={styles.contactSuccess} role="status">Your message was sent. Thank you for getting in touch.</p>}<Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Sending…' : 'Send message'}</Button></form></Card>
}
