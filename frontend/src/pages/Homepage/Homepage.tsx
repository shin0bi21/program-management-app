import PublicTopBar from '../../common/components/PublicTopBar/PublicTopBar'
import Footer from '../../common/components/Footer/Footer'
import ResourceCard from './components/ResourceCard'
import './Homepage.css'

export default function Homepage() {
  const teamResources = [
    {
      name: 'Amanat',
      role: 'Program Facilitator',
      bio: 'Supports youth and families by coordinating enrollment, intake, and follow-up services across partner schools.',
    },
    {
      name: 'Jomarial',
      role: 'Program Facilitator',
      bio: 'Connects participants with transportation, housing, and educational resources through local community partnerships.',
    },
    {
      name: 'Bilal',
      role: 'Program Facilitator',
      bio: 'Works directly with caregivers to improve communication, trust, and access to support programs.',
    },
    {
      name: 'Elijah',
      role: 'Program Facilitator',
      bio: 'Supports participants with day-to-day program engagement and helps coordinate services with families and partners.',
    },
    {
      name: 'Quinton',
      role: 'Program Facilitator',
      bio: 'Helps students connect with tutoring, attendance support, and academic planning resources.',
    },
  ]

  const programs = [
    {
      age: 'Ages 12–15',
      day: 'Every Tuesday',
      copy: 'Youth build soft skills through educational sessions, presentations, hands-on activities, and trips. The focus is on emotion regulation, healthy habits, relationships, and goal-setting that supports consistent school attendance and future pathways.',
      sessions: [
        { date: new Date('2026-04-07'), label: 'Apr 7',  topic: 'Introduction, Expectations & Icebreakers' },
        { date: new Date('2026-04-14'), label: 'Apr 14', topic: 'Emotion Regulation – Identifying Feelings' },
        { date: new Date('2026-04-21'), label: 'Apr 21', topic: 'Emotion Regulation – Skills' },
        { date: new Date('2026-04-28'), label: 'Apr 28', topic: 'Emotion Regulation – Coping Strategies' },
      ],
    },
    {
      age: 'Ages 16–19',
      day: 'Every Wednesday',
      copy: 'Youth receive job-readiness education, interview practice, one-on-one support, volunteer placement experience, and one paid project to strengthen resumes. Program elements also support transitions into post-secondary education and the workforce.',
      sessions: [
        { date: new Date('2026-04-09'), label: 'Apr 9',  topic: 'Program Orientation & Goal Setting' },
        { date: new Date('2026-04-16'), label: 'Apr 16', topic: 'Resume Building Workshop' },
        { date: new Date('2026-04-23'), label: 'Apr 23', topic: 'Interview Prep & Practice' },
        { date: new Date('2026-04-30'), label: 'Apr 30', topic: 'Post-Secondary Navigation' },
      ],
    },
  ]

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  function sessionStatus(date: Date) {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    if (d < today) return 'past'
    if (d.getTime() === today.getTime()) return 'today'
    return 'upcoming'
  }

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
              {programs.map((program) => (
                <div key={program.age} className="this-month-group">
                  <div className="this-month-group-header">
                    <span className="this-month-age">{program.age}</span>
                    <span className="this-month-day">{program.day}</span>
                  </div>
                  <p className="program-copy">{program.copy}</p>
                  <ul className="this-month-list">
                    {program.sessions.map((session) => {
                      const status = sessionStatus(session.date)
                      return (
                        <li key={session.label} className={`this-month-row this-month-row--${status}`}>
                          <span className="this-month-pill">{session.label}</span>
                          <span className="this-month-topic">{session.topic}</span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="about" className="timeline-section" aria-labelledby="timeline-title">
          <div className="section-inner">
            <h2 id="timeline-title" className="section-title">Program History</h2>
            <div className="timeline">
              <div className="timeline-item">
                <p className="timeline-year">2022</p>
                <div className="timeline-body">
                  <p className="timeline-headline">Founded as a volunteer organization</p>
                  <p className="timeline-detail">Be Original Youth Group started with a small team of volunteers committed to supporting youth in their community through hands-on programming and direct outreach.</p>
                </div>
              </div>
              <div className="timeline-item">
                <p className="timeline-year">2024</p>
                <div className="timeline-body">
                  <p className="timeline-headline">$100K in funding &mdash; 150 youth served</p>
                  <p className="timeline-detail">Secured initial funding that allowed the organization to formalize operations, expand partnerships with local schools, and directly serve 150 youth across programming streams.</p>
                </div>
              </div>
              <div className="timeline-item">
                <p className="timeline-year">2026</p>
                <div className="timeline-body">
                  <p className="timeline-headline">New 3-year program launches April 2026</p>
                  <p className="timeline-detail">With renewed funding, Be Original is proud to announce the launch of our new program this spring, bringing structured youth development and job-readiness programs to a broader network of participants and partner schools.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="analytics-section" aria-label="Impact metrics">
          <div className="section-inner">
            <div className="analytics-cards">
              <div className="analytics-card analytics-card--stat">
                <p className="analytics-card-label">Grants received</p>
                <p className="analytics-stat-number">$400K</p>
                <p className="analytics-stat-desc">in funding from the Ontario Trillium Foundation</p>
              </div>
              <div className="analytics-card analytics-card--stat">
                <p className="analytics-card-label">Youth served</p>
                <p className="analytics-stat-number">140+</p>
                <p className="analytics-stat-desc">youth directly served and registered through Be Original programming</p>
              </div>
            </div>
          </div>
        </section>

        <section id="team" className="resources-section" aria-labelledby="resources-section-title">
          <div className="section-inner">
            <h2 id="resources-section-title" className="resources-title section-title">Staff</h2>
            <div className="resource-cards-grid" aria-label="Employee and resource contacts">
              {teamResources.map((resource) => (
                <ResourceCard
                  key={resource.name}
                  name={resource.name}
                  role={resource.role}
                  bio={resource.bio}
                />
              ))}
            </div>
          </div>
        </section>

        <Footer />
      </main>
    </>
  )
}
