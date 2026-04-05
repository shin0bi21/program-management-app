import Header from '../../common/components/Header/Header'
import Footer from '../../common/components/Footer/Footer'
import AboutOrganizationCard from './components/AboutOrganizationCard'
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

  return (
    <>
      <Header />
      <main className="homepage-container">
        <section className="homepage-hero" aria-label="Organization branding">
          <img src="/logo.jpg" alt="Organization logo" className="homepage-logo" />
        </section>

        <section className="about-section" aria-label="About us cards">
          <h2 className="about-section-title">About Us</h2>

          <div className="about-cards-grid">
            <AboutOrganizationCard
              eyebrow="History"
              description="We partner with schools, staff, and local organizations to improve coordination and access to youth and family support services."
            />

            <AboutOrganizationCard
              eyebrow="Mission"
              description="Create a safe, reliable, and human-centered support system that helps every young person get connected to the resources they need."
              highlight
            />
          </div>
        </section>

        <section className="offerings-section" aria-labelledby="offerings-section-title">
          <h2 id="offerings-section-title" className="offerings-kicker">Programming</h2>

          <div className="offerings-grid">
            <article className="offering-card" aria-label="Program for ages 12 to 15">
              <p className="offering-age">Ages 12-15</p>
              <p className="offering-description">
                Youth build soft skills through educational sessions, presentations,
                hands-on activities, and trips. The focus is on emotion regulation,
                healthy habits, relationships, and goal-setting that supports
                consistent school attendance and future pathways.
              </p>
            </article>

            <article className="offering-card" aria-label="Program for ages 16 to 19">
              <p className="offering-age">Ages 16-19</p>
              <p className="offering-description">
                Youth receive job-readiness education, interview practice, one-on-one
                support, volunteer placement experience, and one paid project to
                strengthen resumes. Program elements also support transitions into
                post-secondary education and the workforce.
              </p>
            </article>
          </div>
        </section>

        <section className="resources-section" aria-labelledby="resources-section-title">
          <div className="resources-section-heading">
            <h2 id="resources-section-title" className="resources-title">Our Team</h2>
          </div>

          <div className="resource-cards-grid" aria-label="Employee and resource contacts">
            {teamResources.map((resource, index) => (
              <ResourceCard
                key={resource.name}
                name={resource.name}
                role={resource.role}
                bio={resource.bio}
                reverseLayout={index % 2 === 1}
              />
            ))}
          </div>
        </section>

        <Footer />
      </main>
    </>
  )
}
