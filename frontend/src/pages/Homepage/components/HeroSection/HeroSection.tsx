import { useHeroPhotoCarousel } from './useHeroPhotoCarousel';
import type { HeroSectionProps } from './heroSectionSchema';

export default function HeroSection({ photos }: HeroSectionProps) {
  const { activePhoto, hasMultiplePhotos, goToPreviousPhoto, goToNextPhoto } = useHeroPhotoCarousel({ photos });

  return (
    <section id="home" className="homepage-hero" aria-label="Organization branding">
      <div className={`section-inner hero-inner${activePhoto ? '' : ' hero-inner--without-photo'}`}>
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
              Since 2022, Be Original has supported over 140 youth across Sandwich Towne and Windsor by providing a safe
              space, mentorship as well as programming focused on life skills and career readiness.
            </p>
          </div>
        </div>
        {activePhoto && (
          <div className="hero-visual-panel">
            <div className="hero-visual-card">
              <div className="hero-photo-frame">
                <picture>
                  {activePhoto.mobileSrc && <source media="(max-width: 820px)" srcSet={activePhoto.mobileSrc} />}
                  <img src={activePhoto.src} alt={activePhoto.alt} className="hero-photo-image" />
                </picture>
                {hasMultiplePhotos && (
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
        )}
      </div>
    </section>
  );
}
