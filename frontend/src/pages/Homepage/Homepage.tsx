import { useEffect, useState } from 'react'
import PublicTopBar from '../../common/components/PublicTopBar/PublicTopBar'
import Header from '../../common/components/Header/Header'
import Footer from '../../common/components/Footer/Footer'
import { useAuth } from '../../common/context/AuthContext'
import ResourceCard from './components/ResourceCard'
import SignupSection from './components/SignupSection'
import { useSectionRouting } from './hooks/useSectionRouting'

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

type HomepagePhoto = {
  src: string
  alt: string
  caption: string
}

// ── Page data (in page-section order) ─────────────────────────────────────────────

const programs = [
  {
    age: 'All Ages',
    day: 'Every other Friday',
    copy: 'Welcome to hang out, play video games and board games. A relaxed, open space for youth to connect and unwind.',
    sessions: [
      { date: new Date(2026, 6, 10), topic: 'Drop-in Day' },
      { date: new Date(2026, 6, 24), topic: 'Drop-in Day' },
      // { date: new Date(2026, 7, 7), topic: 'Drop-in Day' },
    ],
    dropIn: true,
  },
  {
    age: 'Ages 12–15',
    title: 'Soft Skills Program',
    day: 'Every Tuesday',
    copy: 'Youth build soft skills through educational sessions, presentations, hands-on activities, and trips. The focus is on emotion regulation, healthy habits, relationships, and goal-setting that supports consistent school attendance and future pathways.',
    sessions: [
      { date: new Date(2026, 6, 7), topic: 'Self-Esteem Workshop' },
      { date: new Date(2026, 6, 14), topic: 'Healthy Habits Guest Speaker' },
      // { date: new Date(2026, 6, 21), topic: 'Confidence Building Workshop' },
      // { date: new Date(2026, 6, 28), topic: 'Self-Estem Trip to Pixel Room' },
    ],
  },
  {
    age: 'Ages 16–19',
    title: 'Job Readiness Program',
    day: 'Every Wednesday',
    copy: 'Youth receive job-readiness education, interview practice, one-on-one support, volunteer placement experience, and one paid project to strengthen resumes. Program elements also support transitions into post-secondary education and the workforce.',
    sessions: [
      { date: new Date(2026, 7, 5), topic: 'Guest Speaker - Tradesperson' },
    ],
  },
]

const timelineItems = [
  { year: '2022', headline: 'Founded as a volunteer organization',       detail: 'Be Original Youth Group was founded in Sandwich Towne, West Windsor by a small team of volunteers committed to supporting youth in their community through hands-on programming and direct outreach.' },
  { year: '2024', headline: 'Became a fully funded organization',        detail: 'Secured our first grant through the Youth Opportunities Fund enabling us to hire dedicated staff, and reach 150 youth through a healthy habits based mentorship program.' },
  { year: '2026', headline: '3-year program launched Spring 2026',        detail: 'With a 3 year grant from Youth Opportunities Fund, Be Original launched a new structured program this spring, expanding youth development and job-readiness streams to a broader network of participants.' },
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
  { name: 'Jomariel', role: 'Program Facilitator', badge: undefined,     education: 'Psychology',           school: 'University of Windsor',    bio: 'Connects participants with transportation, housing, and educational resources through local community partnerships.' },
  { name: 'Elijah',   role: 'Program Facilitator', badge: undefined,     education: undefined,              school: undefined,                  bio: 'Supports participants with day-to-day program engagement and helps coordinate services with families and partners.' },
]

const HOMEPAGE_PHOTO_INTERVAL_MS = 10000

const homepagePhotos: HomepagePhoto[] = [
  {
    src: '/programming/adventure_bay.png',
    alt: 'Youth group trip to Adventure Bay water park',
    caption: 'Our trip to Adventure Bay water park.',
  },
  {
    src: '/programming/community_cleanup.png',
    alt: 'Be Original community cleanup at Malden Park',
    caption: 'Be Original community cleanup at Malden Park.',
  },
  {
    src: '/programming/express_game.png',
    alt: 'Youth attending a Windsor Express game',
    caption: 'Our youth attend a Windsor Express game.',
  },
  {
    src: '/programming/food_drive.png',
    alt: 'Be Original food drive event in 2024',
    caption: 'Be Original\'s first annual food drive raised over $300 for community .',
  },
  {
    src: '/programming/police_guest.png',
    alt: 'Eduardo Averalo of the Windsor Police Service connecting with Be Original youth',
    caption: 'Eduardo Averalo of the Windsor Police Service connects with Be Original youth.',
  },
  {
    src: '/programming/police_guest2.png',
    alt: 'Windsor Police Service guest session with Be Original youth',
    caption: 'Windsor Police Service guest session with Be Original youth.',
  },
  {
    src: '/programming/wonderland.png',
    alt: 'Be Original trip to Canada\'s Wonderland',
    caption: 'Our trip to Canada\'s Wonderland.',
  },
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
  const upcoming = sessionsWithStatus.filter(s => s.status !== 'past')
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
  const [photoIndex, setPhotoIndex] = useState(0)

  const activePhoto = homepagePhotos[photoIndex] ?? homepagePhotos[0]
  useSectionRouting({ disabled: loading })

  useEffect(() => {
    if (homepagePhotos.length <= 1) return

    const intervalId = window.setInterval(() => {
      setPhotoIndex((current) => (current + 1) % homepagePhotos.length)
    }, HOMEPAGE_PHOTO_INTERVAL_MS)

    return () => window.clearInterval(intervalId)
  }, [])

  if (loading) return null

  const goToPreviousPhoto = () => {
    setPhotoIndex((current) => (current - 1 + homepagePhotos.length) % homepagePhotos.length)
  }

  const goToNextPhoto = () => {
    setPhotoIndex((current) => (current + 1) % homepagePhotos.length)
  }

  const content = (
    <main className="homepage-container">
        <section id="home" className="homepage-hero" aria-label="Organization branding">
          <div className="section-inner hero-inner">
            <div className="hero-main">
              <div className="hero-copy">
                <h1 className="hero-title">
                  Support that
                  <br />
                  meets youth
                  <br />
                  <span className="hero-title-accent">where they are.</span>
                </h1>
                <p className="hero-description">
                  Since 2022, Be Original has supported over 140 youth across Sandwich Towne and Windsor by providing a safe space, mentorship as well as programming focused on life skills and career readiness.
                </p>
              </div>
            </div>
            <div className="hero-visual-panel">
              <div className="hero-visual-card">
                <div className="hero-photo-frame">
                  <img
                    src={activePhoto.src}
                    alt={activePhoto.alt}
                    className="hero-photo-image"
                  />
                  {homepagePhotos.length > 1 && (
                    <div className="hero-photo-nav" aria-label="Photo navigation controls">
                      <button
                        type="button"
                        className="hero-photo-nav-button"
                        onClick={goToPreviousPhoto}
                        aria-label="Show previous photo"
                      >
                        &lt;
                      </button>
                      <button
                        type="button"
                        className="hero-photo-nav-button"
                        onClick={goToNextPhoto}
                        aria-label="Show next photo"
                      >
                        &gt;
                      </button>
                    </div>
                  )}
                </div>
                <p className="hero-photo-caption">{activePhoto.caption}</p>
              </div>
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

        <SignupSection />

        <section id="team" className="resources-section" aria-labelledby="resources-section-title">
          <div className="section-inner">
            <div className="section-heading section-heading--split">
              <div className="section-heading-main">
                <h2 id="resources-section-title" className="section-title">Meet our team</h2>
              </div>
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
            <div className="section-heading section-heading--split">
              <div className="section-heading-main">
                <h2 id="partners-title" className="section-title">Partners</h2>
              </div>
            </div>
            <div className="partners-logo-row" aria-label="Community partners">
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
