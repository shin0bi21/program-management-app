import ResourceCard from '../ResourceCard/ResourceCard';

const teamResources = [
  {
    name: 'Quinton Macnevin',
    role: 'Program Facilitator',
    badge: 'Co-founder',
    education: 'Child and Youth Care',
    school: 'Mohawk College',
    imageSrc: '/team/quinton-display.webp',
    imageMobileSrc: '/team/quinton-mobile.webp',
    bio: 'Quinton is the Co-Founder of Be Original Youth Group, where he is committed to creating a safe, welcoming space for youth to be themselves while developing important life skills. A graduate of Mohawk College’s Child and Youth Care program, Quinton has worked with youth and adults since 2017 through organizations including the Boys & Girls Club of Hamilton, the Downtown Mission, and the Salvation Army. Drawing from both his professional experience and his lived experience as a former Crown ward, he is passionate about helping young people build confidence, strengthen their life skills, and discover their potential.',
  },
  {
    name: 'Amanat',
    role: 'Program Facilitator',
    badge: 'Co-founder',
    education: 'Master of Social Work',
    school: 'University of Windsor',
    imageSrc: '/team/amanat-display.webp',
    imageMobileSrc: '/team/amanat-mobile.webp',
    bio: 'Hi, my name is Amanat! I was born in India and immigrated to Canada when I was 5 years old. I didn’t have any older siblings, so growing up that sometimes that left me without someone I could share problems with or get advice from. I also let anxiety and anger get in the way of many things I wanted to do. I am hoping this mentorship program can save you some of the trouble I experienced and help you succeed! I am so excited to work with you all :)',
  },
  {
    name: 'Bilal',
    role: 'Program Facilitator',
    badge: 'Treasurer',
    education: 'Computer Science',
    school: 'University of Windsor',
    imageSrc: '/team/bilal-display.webp',
    imageMobileSrc: '/team/bilal-mobile.webp',
    bio: "Hi, I'm Bilal! I've been a part of Be Original since 2022. Over the years, I've worked directly with the youth. I originally ran our healthy activity/ eating days, and I now run the Job Readiness program with Elijah. On the backend, I also do our accounting and build out website, including the page you see now, and our backend management system! I hope to connect with all the youth that walk through our doors and serve as a positive force in their life as they grow up.",
  },
  {
    name: 'Jomariel',
    role: 'Program Facilitator',
    badge: undefined,
    education: 'Psychology',
    school: 'University of Windsor',
    imageSrc: '/team/jomariel-display.webp',
    imageMobileSrc: '/team/jomariel-mobile.webp',
    bio: 'Hello everyone! My name is Jomariel, and I am one of the coordinators and facilitators for this youth group! I’m so grateful to be a part of this community and to help create a safe, welcoming space where you can grow, feel supported, and truly be yourselves. I immigrated from the Philippines and moved to Windsor when I was about four years old, and that journey has shaped my love for connection, resilience, and understanding others. My goal is to share meaningful life lessons that aren’t always taught in school such as kindness, empathy, confidence, and real-world skills, while being someone you can trust as both a mentor and friend. I will be working with youth ages 12-15 years old. Outside of the group, I love expressing myself through singing and playing the guitar and piano, staying active with tennis, running, and long walks, and spending quality time with my family and friends. I also enjoy cooking, baking, writing, and reading. I am so excited to meet each of you, learn together, and build something really special as a group!',
  },
  {
    name: 'Elijah',
    role: 'Program Facilitator',
    badge: undefined,
    education: undefined,
    school: undefined,
    imageSrc: '/team/elijah-display.webp',
    imageMobileSrc: '/team/elijah-mobile.webp',
    bio: "I serve my community willingly with the utmost humility. Within that community, I have taken on many roles—a student, a teacher, and a role model—all of which I don't take for granted. Being apart of BeOriginal has allowed me to embody all three of these wonderful roles and use them to embrace and empower the next generation. I will use whatever gifts I have received to serve gracefully in all of their various forms.",
  },
];

export default function TeamSection() {
  return (
    <section id="team" className="resources-section" aria-labelledby="resources-section-title">
      <div className="section-inner">
        <div className="section-heading section-heading--split">
          <div className="section-heading-main">
            <h2 id="resources-section-title" className="section-title">Meet our team</h2>
          </div>
        </div>
        <div className="resource-cards-grid" role="list" aria-labelledby="resources-section-title">
          {teamResources.map((resource) => (
            <ResourceCard key={resource.name} {...resource} />
          ))}
        </div>
      </div>
    </section>
  );
}
