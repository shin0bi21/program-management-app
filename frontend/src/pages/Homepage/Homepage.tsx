import PublicTopBar from '../../common/components/PublicTopBar/PublicTopBar'
import Footer from '../../common/components/Footer/Footer'
import ResourceCard from './components/ResourceCard'
import './Homepage.css'

const teamResources = [
  { name: 'Amanat',   role: 'Program Facilitator', badge: 'Co-founder', education: 'Master of Social Work', school: 'University of Windsor',          bio: 'Supports youth and families by coordinating enrollment, intake, and follow-up services across partner schools.' },
  { name: 'Quinton',  role: 'Program Facilitator', badge: 'Co-founder',  education: undefined,              school: undefined,                  bio: 'Helps students connect with tutoring, attendance support, and academic planning resources.' },
  { name: 'Bilal',    role: 'Program Facilitator', badge: 'Treasurer',   education: 'Computer Science',     school: 'University of Windsor',    bio: 'Works directly with caregivers to improve communication, trust, and access to support programs.' },
  { name: 'Jomariel', role: 'Program Facilitator', badge: undefined,     education: 'Human Kinetics',       school: 'University of Windsor',    bio: 'Connects participants with transportation, housing, and educational resources through local community partnerships.' },
  { name: 'Elijah',   role: 'Program Facilitator', badge: undefined,     education: undefined,              school: undefined,                  bio: 'Supports participants with day-to-day program engagement and helps coordinate services with families and partners.' },
]

const programs = [
  {
    age: 'Ages 12–15',
    day: 'Every Tuesday',
    copy: 'Youth build soft skills through educational sessions, presentations, hands-on activities, and trips. The focus is on emotion regulation, healthy habits, relationships, and goal-setting that supports consistent school attendance and future pathways.',
    sessions: [
      { date: new Date(2026, 4,  5), label: 'May 5',  topic: 'Yoga' },
      { date: new Date(2026, 4, 12), label: 'May 12', topic: 'Healthy Relationships & Boundaries' },
      { date: new Date(2026, 4, 19), label: 'May 19', topic: 'Assertiveness & Emotional Control' },
      { date: new Date(2026, 4, 26), label: 'May 26', topic: 'Conflict Resolution' },
      { date: new Date(2026, 5,  2), label: 'Jun 2',  topic: 'Field Trip' },
    ],
  },
  {
    age: 'Ages 16–19',
    day: 'Every Wednesday',
    copy: 'Youth receive job-readiness education, interview practice, one-on-one support, volunteer placement experience, and one paid project to strengthen resumes. Program elements also support transitions into post-secondary education and the workforce.',
    sessions: [
      { date: new Date(2026, 4,  6), label: 'May 6',  topic: 'Communication' },
      { date: new Date(2026, 4, 13), label: 'May 13', topic: 'Interview Prep' },
      { date: new Date(2026, 4, 20), label: 'May 20', topic: 'Cover Letter Writing' },
      { date: new Date(2026, 4, 27), label: 'May 27', topic: 'Open Session' },
    ],
  },
]

const timelineItems = [
  { year: '2022', headline: 'Founded as a volunteer organization',       detail: 'Be Original Youth Group was founded in Sandwich Town, West Windsor by a small team of volunteers committed to supporting youth in their community through hands-on programming and direct outreach.' },
  { year: '2024', headline: 'Became a fully funded organization',               detail: 'Secured our first institutional funding, enabling us to hire dedicated staff, deepen school partnerships, and reach 150 youth through mentorship, arts, and leadership programs.' },
  { year: '2026', headline: '3-year program launched Spring 2026',        detail: 'With renewed funding, Be Original launched a new structured program this spring, expanding youth development and job-readiness streams to a broader network of participants and partner schools.' },
]

const impactStats = [
  { label: 'Years running',   number: '4',     desc: 'years of community programming since founding in 2022' },
  { label: 'Grants received', number: '$400K', desc: 'in funding from the Ontario Trillium Foundation' },
  { label: 'Youth served',    number: '140+',  desc: 'youth directly served and registered through Be Original programming' },
]

const partners = [
  { name: 'Ontario Trillium Foundation', logo: '/partners/otf.png' },
]

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

export default function Homepage() {
  return (
    <>
      <PublicTopBar />
      <main className="homepage-container">
        <section className="homepage-hero" aria-label="Organization branding">
          <p className="hero-kicker">Be Original Youth Group</p>
          <h1 className="hero-title">Support that meets youth where they are.</h1>
          <p className="hero-description">
            We work alongside schools, caregivers, and partners to make youth services
            easier to access, easier to trust, and easier to sustain.
          </p>
        </section>

        <section id="programming" className="offerings-section" aria-labelledby="offerings-title">
          <div className="section-inner">
            <h2 id="offerings-title" className="section-title">Programming</h2>
            <div className="program-grid">
              {programs.map((program) => {
                const sessionsWithStatus = program.sessions.map(s => ({ ...s, status: sessionStatus(s.date) }))
                const upcoming = sessionsWithStatus.filter(s => s.status !== 'past')
                const next = upcoming[0] ?? null
                const following = upcoming.slice(1)
                const nextDays = next ? daysUntil(next.date) : null

                return (
                  <article key={program.age} className="program-card">
                    <header className="program-card-head">
                      <p className="program-age">{program.age}</p>
                    </header>

                    <div className="program-copy-block">
                      <span className="program-copy-label">About this program</span>
                      <p className="program-copy">{program.copy}</p>
                    </div>

                    <div className="program-sessions">
                      <p className="program-sessions-label">Upcoming</p>
                      {upcoming.length === 0 ? (
                        <p className="program-empty">All sessions complete for this cycle.</p>
                      ) : (
                        <>
                          <div className="next-session" aria-label="Next session">
                            <div className="next-session-date">
                              <span className="next-session-day">{next!.date.getDate()}</span>
                              <span className="next-session-month">{MONTH_FMT.format(next!.date)}</span>
                            </div>
                            <div className="next-session-body">
                              <span className="next-session-tag">
                                {nextDays === 0 ? 'Today' : nextDays === 1 ? 'Tomorrow' : `In ${nextDays} days`}
                              </span>
                              <p className="next-session-topic">{next!.topic}</p>
                              <p className="next-session-weekday">{WEEKDAY_FMT.format(next!.date)}</p>
                            </div>
                          </div>
                          {following.length > 0 && (
                            <ul className="upcoming-rows">
                              {following.map((session) => (
                                <li key={session.label} className="upcoming-row">
                                  <span className="upcoming-row-date">
                                    <strong>{session.date.getDate()}</strong>
                                    <span>{MONTH_FMT.format(session.date)}</span>
                                  </span>
                                  <span className="upcoming-row-topic">{session.topic}</span>
                                  <span className="upcoming-row-weekday">{WEEKDAY_FMT.format(session.date)}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        <section id="about" className="timeline-section" aria-labelledby="timeline-title">
          <div className="section-inner">
            <h2 id="timeline-title" className="section-title">Organizational History</h2>
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

        <section id="impact" className="analytics-section" aria-labelledby="analytics-title">
          <div className="section-inner">
            <h2 id="analytics-title" className="section-title">Impact</h2>
            <div className="analytics-cards">
              {impactStats.map((stat) => (
                <div key={stat.label} className="analytics-card analytics-card--stat">
                  <p className="analytics-stat-number">{stat.number}</p>
                  <p className="analytics-card-label">{stat.label}</p>
                  <p className="analytics-stat-desc">{stat.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="team" className="resources-section" aria-labelledby="resources-section-title">
          <div className="section-inner">
            <h2 id="resources-section-title" className="resources-title section-title">Staff</h2>
            <div className="resource-cards-grid" aria-label="Employee and resource contacts">
              {teamResources.map((resource) => (
                <ResourceCard key={resource.name} {...resource} />
              ))}
            </div>
          </div>
        </section>

        <section id="partners" className="partners-section" aria-labelledby="partners-title">
          <div className="section-inner">
            <h2 id="partners-title" className="section-title">Partners</h2>
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
    </>
  )
}
