import PublicTopBar from '../../common/components/PublicTopBar/PublicTopBar';
import SiteFooter from './components/SiteFooter/SiteFooter';
import HeroSection from './components/HeroSection/HeroSection';
import { heroSectionPhotos } from './components/HeroSection/heroSectionData';
import type { HeroPhoto } from './components/HeroSection/heroSectionSchema';
import ProgrammingSection from './components/ProgrammingSection/ProgrammingSection';
import ResourceCard from './components/ResourceCard';
import SignupSection from './components/SignupSection/SignupSection';
import { useSectionRouting } from './hooks/useSectionRouting';
import { useHomepageContent } from './hooks/useHomepageContent';
import type { HomepageSession } from './api/homepage.api';

import './Homepage.css';
import '../../common/styles/forms.css';

// ── Page data (in page-section order) ─────────────────────────────────────────────

const timelineItems = [
  {
    year: '2022',
    headline: 'Founded as a volunteer organization',
    detail:
      'Be Original Youth Group was founded in Sandwich Towne, West Windsor by a small team of volunteers committed to supporting youth in their community through hands-on programming and direct outreach.',
  },
  {
    year: '2024',
    headline: 'Became a fully funded organization',
    detail:
      'Secured our first grant through the Youth Opportunities Fund enabling us to hire dedicated staff, and reach 150 youth through a healthy habits based mentorship program.',
  },
  {
    year: '2026',
    headline: '3-year program launched Spring 2026',
    detail:
      'With a 3 year grant from Youth Opportunities Fund, Be Original launched a new structured program this spring, expanding youth development and job-readiness streams to a broader network of participants.',
  },
];

const partners = [
  { name: 'Ontario Trillium Foundation', logo: '/partners/otf.png' },
  { name: 'STAG', logo: '/partners/stag.png' },
  { name: 'Workforce WindsorEssex', logo: '/partners/workforce.jpg' },
];

const teamResources = [
  {
    name: 'Quinton Macnevin',
    role: 'Program Facilitator',
    badge: 'Co-founder',
    education: 'Child and Youth Care',
    school: 'Mohawk College',
    imageSrc: '/team/quinton.png',
    bio: 'Quinton is the Co-Founder of Be Original Youth Group, where he is committed to creating a safe, welcoming space for youth to be themselves while developing important life skills. A graduate of Mohawk College’s Child and Youth Care program, Quinton has worked with youth and adults since 2017 through organizations including the Boys & Girls Club of Hamilton, the Downtown Mission, and the Salvation Army. Drawing from both his professional experience and his lived experience as a former Crown ward, he is passionate about helping young people build confidence, strengthen their life skills, and discover their potential.',
  },
  {
    name: 'Amanat',
    role: 'Program Facilitator',
    badge: 'Co-founder',
    education: 'Master of Social Work',
    school: 'University of Windsor',
    imageSrc: '/team/amanat.png',
    bio: 'Hi, my name is Amanat! I was born in India and immigrated to Canada when I was 5 years old. I didn’t have any older siblings, so growing up that sometimes that left me without someone I could share problems with or get advice from. I also let anxiety and anger get in the way of many things I wanted to do. I am hoping this mentorship program can save you some of the trouble I experienced and help you succeed! I am so excited to work with you all :)',
  },
  {
    name: 'Bilal',
    role: 'Program Facilitator',
    badge: 'Treasurer',
    education: 'Computer Science',
    school: 'University of Windsor',
    bio: 'Works directly with caregivers to improve communication, trust, and access to support programs.',
  },
  {
    name: 'Jomariel',
    role: 'Program Facilitator',
    badge: undefined,
    education: 'Psychology',
    school: 'University of Windsor',
    bio: 'Connects participants with transportation, housing, and educational resources through local community partnerships.',
  },
  {
    name: 'Elijah',
    role: 'Program Facilitator',
    badge: undefined,
    education: undefined,
    school: undefined,
    imageSrc: '/team/elijah.png',
    bio: "I serve my community willingly with the utmost humility. Within that community, I have taken on many roles—a student, a teacher, and a role model—all of which I don't take for granted. Being apart of BeOriginal has allowed me to embody all three of these wonderful roles and use them to embrace and empower the next generation. I will use whatever gifts I have received to serve gracefully in all of their various forms.",
  },
];

// ── Component ───────────────────────────────────────────────────────────────────────────────

export function HomepageContent({ photos, sessions }: { photos: HeroPhoto[]; sessions: HomepageSession[] }) {
  return (
    <main className="homepage-container homepage-theme">
      <HeroSection photos={photos} />
      <ProgrammingSection sessions={sessions} />

      <SignupSection />

      <section id="about" className="timeline-section" aria-labelledby="timeline-title">
        <div className="section-inner">
          <div className="section-heading">
            <h2 id="timeline-title" className="section-title">
              Organizational History
            </h2>
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
          <div className="section-heading section-heading--split">
            <div className="section-heading-main">
              <h2 id="resources-section-title" className="section-title">
                Meet our team
              </h2>
            </div>
          </div>
          <div className="resource-cards-grid" role="list" aria-labelledby="resources-section-title">
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
              <h2 id="partners-title" className="section-title">
                Partners
              </h2>
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

      <SiteFooter />
    </main>
  );
}

export default function Homepage() {
  const { content, error, loading } = useHomepageContent();
  useSectionRouting({ disabled: loading });

  const photos = error
    ? heroSectionPhotos
    : content.images.map((image) => ({
        src: image.imageUrl,
        alt: image.altText,
        caption: image.caption,
      }));

  return (
    <div className="homepage-theme">
      <PublicTopBar />
      <HomepageContent photos={photos} sessions={content.sessions} />
    </div>
  );
}
