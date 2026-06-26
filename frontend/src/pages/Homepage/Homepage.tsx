import { FormEvent, useEffect, useState } from 'react'
import PublicTopBar from '../../common/components/PublicTopBar/PublicTopBar'
import Header from '../../common/components/Header/Header'
import Footer from '../../common/components/Footer/Footer'
import Button from '../../common/components/Button/Button'
import FormField from '../../common/components/FormField/FormField'
import { useAuth } from '../../common/context/AuthContext'
import { useSubmitStatus } from '../../common/hooks/useSubmitStatus'
import { ApiError, getErrorMessage } from '../../common/utils/clientErrors'
import ResourceCard from './components/ResourceCard'
import { submitCohortInterest } from './api/homepage.api'
import './Homepage.css'
import '../../common/styles/forms.css'

// ── Types ─────────────────────────────────────────────────────────────────────────

type SessionWithStatus = {
  date: Date
  topic: string
  status: string
}

type UpcomingSessionsProps = {
  upcoming: SessionWithStatus[]
  nextDays: number | null
  dropIn?: boolean
}

type Program = {
  age: string
  day: string
  copy: string
  sessions: { date: Date; topic: string }[]
  title?: string
  dropIn?: boolean
}

type ProgramCardProps = {
  program: Program
}

type CohortInterestForm = {
  youthName: string
  parentName: string
  age: string
  school: string
  email: string
  phoneNumber: string
  discoverySource: string
  message: string
}

type CohortInterestErrors = Partial<Record<keyof CohortInterestForm, string>>

// ── Page data (in page-section order) ─────────────────────────────────────────────

const programs = [
  {
    age: 'All Ages',
    day: 'Every other Friday',
    copy: 'Welcome to hang out, play video games and board games. A relaxed, open space for youth to connect and unwind.',
    sessions: [
      { date: new Date(2026, 5, 26), topic: 'Drop-in Day' },
      { date: new Date(2026, 6, 10), topic: 'Drop-in Day' },
      { date: new Date(2026, 6, 24), topic: 'Drop-in Day' },
    ],
    dropIn: true,
  },
  {
    age: 'Ages 12–15',
    title: 'Soft Skills Program',
    day: 'Every Tuesday',
    copy: 'Youth build soft skills through educational sessions, presentations, hands-on activities, and trips. The focus is on emotion regulation, healthy habits, relationships, and goal-setting that supports consistent school attendance and future pathways.',
    sessions: [
      { date: new Date(2026, 5, 30), topic: 'Healthy Habits Guest Speaker' },
    ],
  },
  {
    age: 'Ages 16–19',
    title: 'Job Readiness Program',
    day: 'Every Wednesday',
    copy: 'Youth receive job-readiness education, interview practice, one-on-one support, volunteer placement experience, and one paid project to strengthen resumes. Program elements also support transitions into post-secondary education and the workforce.',
    sessions: [
      { date: new Date(2026, 4,  6), topic: 'Communication' },
      { date: new Date(2026, 4, 13), topic: 'Interview Prep' },
      { date: new Date(2026, 4, 20), topic: 'Cover Letter Writing' },
    ],
  },
]

const timelineItems = [
  { year: '2022', headline: 'Founded as a volunteer organization',       detail: 'Be Original Youth Group was founded in Sandwich Towne, West Windsor by a small team of volunteers committed to supporting youth in their community through hands-on programming and direct outreach.' },
  { year: '2024', headline: 'Became a fully funded organization',        detail: 'Secured our first grant through the Youth Opportunities Fund enabling us to hire dedicated staff, and reach 150 youth through a healthy habits based mentorship program.' },
  { year: '2026', headline: '3-year program launched Spring 2026',        detail: 'With a 3 year grant from Youth Opportunities Fund, Be Original launched a new structured program this spring, expanding youth development and job-readiness streams to a broader network of participants and partner schools.' },
]

const impactStats = [
  { label: 'Years running', number: '4' },
  { label: 'Youth served', number: '140+' },
  { label: 'Grants received', number: '$400K', desc: 'from the Ontario Trillium Foundation' },
]

const partners = [
  { name: 'Ontario Trillium Foundation', logo: '/partners/otf.png' },
  { name: 'STAG', logo: '/partners/stag.png' },
  { name: 'Workforce WindsorEssex', logo: '/partners/workforce.jpg' },
]

const teamResources = [
  { name: 'Amanat',   role: 'Program Facilitator', badge: 'Co-founder', education: 'Master of Social Work', school: 'University of Windsor',          bio: 'Supports youth and families by coordinating enrollment, intake, and follow-up services across partner schools.' },
  { name: 'Quinton',  role: 'Program Facilitator', badge: 'Co-founder',  education: undefined,              school: undefined,                  bio: 'Helps students connect with tutoring, attendance support, and academic planning resources.' },
  { name: 'Bilal',    role: 'Program Facilitator', badge: 'Treasurer',   education: 'Computer Science',     school: 'University of Windsor',    bio: 'Works directly with caregivers to improve communication, trust, and access to support programs.' },
  { name: 'Jomariel', role: 'Program Facilitator', badge: undefined,     education: 'Human Kinetics',       school: 'University of Windsor',    bio: 'Connects participants with transportation, housing, and educational resources through local community partnerships.' },
  { name: 'Elijah',   role: 'Program Facilitator', badge: undefined,     education: undefined,              school: undefined,                  bio: 'Supports participants with day-to-day program engagement and helps coordinate services with families and partners.' },
]

const cohortInterestInitialState: CohortInterestForm = {
  youthName: '',
  parentName: '',
  age: '',
  school: '',
  email: '',
  phoneNumber: '',
  discoverySource: '',
  message: '',
}

const discoverySourceOptions = [
  { value: 'online', label: 'Online' },
  { value: 'friend_family', label: 'Friend / Family' },
  { value: 'school', label: 'School' },
  { value: 'community_outreach', label: 'Community Outreach' },
  { value: 'other', label: 'Other' },
]

// ── Session utilities ─────────────────────────────────────────────────────

const TODAY = new Date()
TODAY.setHours(0, 0, 0, 0)

const MS_PER_DAY = 1000 * 60 * 60 * 24

function sessionStatus(date: Date): 'past' | 'today' | 'upcoming' {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  if (d < TODAY) return 'past'
  if (d.getTime() === TODAY.getTime()) return 'today'
  return 'upcoming'
}

function daysUntil(date: Date): number {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - TODAY.getTime()) / MS_PER_DAY)
}

const WEEKDAY_FMT = new Intl.DateTimeFormat('en-US', { weekday: 'long' })
const MONTH_FMT   = new Intl.DateTimeFormat('en-US', { month: 'short' })

// ── Render helpers ───────────────────────────────────────────────────────────────────────────────

function UpcomingSessions({ upcoming, nextDays, dropIn }: UpcomingSessionsProps) {
  const next = upcoming[0] ?? null
  const following = upcoming.slice(1)

  if (upcoming.length === 0) {
    return (
      <p className="program-empty">
        {dropIn ? 'No upcoming drop-in days scheduled.' : 'All sessions complete for this cycle.'}
      </p>
    )
  }

  return (
    <>
      <div className="next-session" aria-label={dropIn ? 'Next drop-in day' : 'Next session'}>
        <div className="next-session-date">
          <span className="next-session-day">{next!.date.getDate()}</span>
          <span className="next-session-month">{MONTH_FMT.format(next!.date)}</span>
        </div>
        <div className="next-session-body">
          <span className="next-session-tag">
            {nextDays === 0 ? 'Today' : nextDays === 1 ? 'Tomorrow' : `In ${nextDays} days`}
          </span>
          <p className="next-session-topic">{dropIn ? 'Drop-in Day' : next!.topic}</p>
          <p className="next-session-weekday">{WEEKDAY_FMT.format(next!.date)}</p>
        </div>
      </div>
      {following.length > 0 && (
        <ul className="upcoming-rows">
          {following.map((s) => (
            <li key={s.date.toISOString()} className="upcoming-row">
              <span className="upcoming-row-date">
                <strong>{s.date.getDate()}</strong>
                <span>{MONTH_FMT.format(s.date)}</span>
              </span>
              <span className="upcoming-row-topic">{dropIn ? 'Drop-in Day' : s.topic}</span>
              <span className="upcoming-row-weekday">{WEEKDAY_FMT.format(s.date)}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function ProgramCard({ program }: ProgramCardProps) {
  const sessionsWithStatus = program.sessions.map(s => ({ ...s, status: sessionStatus(s.date) }))
  const upcoming = sessionsWithStatus.filter(
    s => s.status !== 'past' &&
    s.date.getMonth() === TODAY.getMonth() &&
    s.date.getFullYear() === TODAY.getFullYear()
  )
  const nextDays = upcoming[0] ? daysUntil(upcoming[0].date) : null

  return (
    <article className="program-card">
      <header className="program-card-head">
        <span className="program-schedule">{program.day}</span>
        <p className="program-age">{program.age}</p>
      </header>
      <div className="program-copy-block">
        <span className="program-copy-label">{program.dropIn ? 'Drop-in Days' : program.title}</span>
        <p className="program-copy">{program.copy}</p>
      </div>
      <div className="program-sessions">
        <p className="program-sessions-label">Upcoming</p>
        <UpcomingSessions upcoming={upcoming} nextDays={nextDays} dropIn={program.dropIn} />
      </div>
    </article>
  )
}

// ── Component ───────────────────────────────────────────────────────────────────────────────

export default function Homepage() {
  const { isAuthenticated, loading } = useAuth()
  const [formData, setFormData] = useState<CohortInterestForm>(cohortInterestInitialState)
  const [fieldErrors, setFieldErrors] = useState<CohortInterestErrors>({})
  const { submitStatus, setSubmitStatus, error, setError, resetStatus } = useSubmitStatus()
  const isFormLocked = submitStatus === 'submitting' || submitStatus === 'success'

  useEffect(() => {
    if (submitStatus !== 'success') return

    const timeoutId = window.setTimeout(() => {
      resetStatus()
    }, 2500)

    return () => window.clearTimeout(timeoutId)
  }, [submitStatus, resetStatus])

  if (loading) return null

  const handleFieldChange = (field: keyof CohortInterestForm, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
  }

  const handleInterestSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitStatus('submitting')
    setError('')
    setFieldErrors({})

    try {
      await submitCohortInterest({
        youthName: formData.youthName,
        parentName: formData.parentName.trim() || undefined,
        age: Number(formData.age),
        school: formData.school.trim() || undefined,
        email: formData.email.trim() || undefined,
        phoneNumber: formData.phoneNumber.trim() || undefined,
        discoverySource: formData.discoverySource ? formData.discoverySource as 'online' | 'friend_family' | 'school' | 'community_outreach' | 'other' : undefined,
        message: formData.message.trim() || undefined,
      })
      setFormData(cohortInterestInitialState)
      setFieldErrors({})
      setSubmitStatus('success')
    } catch (err) {
      if (err instanceof ApiError && err.details?.length) {
        const nextFieldErrors: CohortInterestErrors = {}
        for (const detail of err.details) {
          const field = detail.field.replace(/^body\./, '') as keyof CohortInterestForm
          nextFieldErrors[field] = detail.message
        }
        setFieldErrors(nextFieldErrors)
      }
      setSubmitStatus('error')
      setError(getErrorMessage(err, 'Unable to submit the form right now.'))
    }
  }

  const content = (
    <main className="homepage-container">
        <section className="homepage-hero" aria-label="Organization branding">
          <div className="hero-main">
            <div className="hero-copy">
              <h1 className="hero-title">Support that meets youth where they are.</h1>
              <p className="hero-description">
                Since 2022, Be Original has supported youth across Sandwich Towne and Windsor by providing a safe space, mentorship as well as programming focused on life skills and career readiness.
              </p>
            </div>
            <div className="hero-mini-stats" aria-label="Organization impact">
              {impactStats.map((stat) => (
                <div key={stat.label} className="hero-mini-stat">
                  <strong>{stat.number}</strong>
                  <span>{stat.label}</span>
                  {stat.desc && <small>{stat.desc}</small>}
                </div>
              ))}
            </div>
          </div>
          <div className="hero-visual-panel" aria-hidden="true">
            <div className="hero-visual-card">
              <span className="hero-visual-year">Est. 2022</span>
            </div>
          </div>
        </section>

        <section id="programming" className="offerings-section" aria-labelledby="offerings-title">
          <div className="section-inner">
            <div className="section-heading">
              <h2 id="offerings-title" className="section-title">Programming</h2>
            </div>
            <div className="program-grid">
              {programs.map((program) => (
                <ProgramCard key={program.age} program={program} />
              ))}
            </div>
          </div>
        </section>

        <section id="signup" className="cohort-section" aria-labelledby="cohort-section-title">
          <div className="section-inner">
            <div className="cohort-section-copy" data-scroll-target="true">
              <h2 id="cohort-section-title" className="section-title">Interested?</h2>
              <p className="cohort-section-title">We are now accepting signups for our August cohort.</p>
              <p className="cohort-section-description">
                 Leave your contact information below and we will follow up with next steps.
              </p>
            </div>
            <div className="cohort-form-shell">
              <form
                className={`cohort-inline-form${submitStatus === 'success' ? ' cohort-inline-form--muted' : ''}`}
                onSubmit={handleInterestSubmit}
              >
                <fieldset className="cohort-inline-form-fields" disabled={isFormLocked}>
                  {submitStatus === 'error' && error && (
                    <div className="form-error">{error}</div>
                  )}
                  <div className="form-row">
                    <FormField id="cohort-youthName" label="Youth Name" error={fieldErrors.youthName}>
                      <input
                        id="cohort-youthName"
                        value={formData.youthName}
                        onChange={(event) => handleFieldChange('youthName', event.target.value)}
                        autoComplete="name"
                      />
                    </FormField>
                    <FormField id="cohort-parentName" label="Parent Name" error={fieldErrors.parentName}>
                      <input
                        id="cohort-parentName"
                        value={formData.parentName}
                        onChange={(event) => handleFieldChange('parentName', event.target.value)}
                        autoComplete="name"
                      />
                    </FormField>
                  </div>
                  <div className="form-row">
                    <FormField id="cohort-age" label="Age" error={fieldErrors.age}>
                      <input
                        id="cohort-age"
                        type="number"
                        min="1"
                        max="120"
                        value={formData.age}
                        onChange={(event) => handleFieldChange('age', event.target.value)}
                        inputMode="numeric"
                      />
                    </FormField>
                    <FormField id="cohort-school" label="School" error={fieldErrors.school}>
                      <input
                        id="cohort-school"
                        value={formData.school}
                        onChange={(event) => handleFieldChange('school', event.target.value)}
                      />
                    </FormField>
                  </div>
                  <div className="form-row">
                    <FormField id="cohort-email" label="Email" error={fieldErrors.email}>
                      <input
                        id="cohort-email"
                        type="email"
                        value={formData.email}
                        onChange={(event) => handleFieldChange('email', event.target.value)}
                        autoComplete="email"
                      />
                    </FormField>
                    <FormField id="cohort-phoneNumber" label="Phone Number" error={fieldErrors.phoneNumber}>
                      <input
                        id="cohort-phoneNumber"
                        value={formData.phoneNumber}
                        onChange={(event) => handleFieldChange('phoneNumber', event.target.value)}
                        autoComplete="tel"
                      />
                    </FormField>
                  </div>
                  <div className="form-row">
                    <FormField id="cohort-discoverySource" label="How Did You Hear About Us?" error={fieldErrors.discoverySource}>
                      <select
                        id="cohort-discoverySource"
                        value={formData.discoverySource}
                        onChange={(event) => handleFieldChange('discoverySource', event.target.value)}
                      >
                        <option value="">Select one</option>
                        {discoverySourceOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </FormField>
                  </div>
                  <FormField id="cohort-message" label="Anything else we should know?" error={fieldErrors.message}>
                    <textarea
                      id="cohort-message"
                      rows={5}
                      value={formData.message}
                      onChange={(event) => handleFieldChange('message', event.target.value)}
                    />
                  </FormField>
                  <div className="cohort-inline-form-actions">
                    <Button type="submit" disabled={submitStatus === 'submitting'}>
                      {submitStatus === 'submitting' ? 'Submitting...' : 'Submit'}
                    </Button>
                  </div>
                </fieldset>
              </form>
              {submitStatus === 'success' && (
                <div className="cohort-success-overlay" aria-live="polite">
                  <div className="cohort-success-card">
                    <p className="cohort-success-title">Thank you for your submission.</p>
                    <p className="cohort-success-copy">We will be in touch with next steps soon.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section id="about" className="timeline-section" aria-labelledby="timeline-title">
          <div className="section-inner">
            <div className="section-heading">
              <h2 id="timeline-title" className="section-title">Organizational History</h2>
            </div>
            <div className="timeline">
              {timelineItems.map((item) => (
                <div key={item.year} className="timeline-item">
                  <p className="timeline-year">{item.year}</p>
                  <div className="timeline-body">
                    <p className="timeline-headline">{item.headline}</p>
                    <p className="timeline-detail">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="team" className="resources-section" aria-labelledby="resources-section-title">
          <div className="section-inner">
            <div className="section-heading">
              <h2 id="resources-section-title" className="resources-title section-title">Meet our team</h2>
            </div>
            <div className="resource-cards-grid" aria-label="Employee and resource contacts">
              {teamResources.map((resource) => (
                <ResourceCard key={resource.name} {...resource} />
              ))}
            </div>
          </div>
        </section>

        <section id="partners" className="partners-section" aria-labelledby="partners-title">
          <div className="section-inner">
            <div className="section-heading">
              <h2 id="partners-title" className="section-title">Partners</h2>
            </div>
            <div className="partners-logo-row">
              {partners.map((p) => (
                <div key={p.name} className="partners-logo-item">
                  <img src={p.logo} alt={p.name} className="partners-logo" />
                </div>
              ))}
            </div>
          </div>
        </section>

        <Footer />
    </main>
  )

  if (isAuthenticated) {
    return (
      <>
        <Header />
        <div className="page-container">{content}</div>
      </>
    )
  }

  return (
    <>
      <PublicTopBar />
      {content}
    </>
  )
}
