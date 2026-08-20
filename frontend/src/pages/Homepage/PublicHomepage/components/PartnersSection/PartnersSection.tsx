const partners = [
  { name: 'Ontario Trillium Foundation', logo: '/partners/otf.png' },
  { name: 'STAG', logo: '/partners/stag.png' },
  { name: 'Workforce WindsorEssex', logo: '/partners/workforce.jpg' },
];

export default function PartnersSection() {
  return (
    <section id="partners" className="partners-section" aria-labelledby="partners-title">
      <div className="section-inner">
        <div className="section-heading section-heading--split">
          <div className="section-heading-main">
            <h2 id="partners-title" className="section-title">Partners</h2>
          </div>
        </div>
        <div className="partners-logo-row" aria-label="Community partners">
          {partners.map((partner) => (
            <div key={partner.name} className="partners-logo-item">
              <img src={partner.logo} alt={partner.name} className="partners-logo" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
