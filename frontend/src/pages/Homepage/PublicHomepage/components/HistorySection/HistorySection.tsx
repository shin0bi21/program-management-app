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

export default function HistorySection() {
  return (
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
  );
}
