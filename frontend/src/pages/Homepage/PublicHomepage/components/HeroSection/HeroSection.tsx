import Button from '../../../../../common/components/Button/Button';
import LoadingSpinner from '../../../../../common/components/LoadingSpinner/LoadingSpinner';
import { useHeroPhotoCarousel } from './useHeroPhotoCarousel';
import HeroPhoto from './HeroPhoto';
import type { HeroSectionProps } from './heroSectionSchema';

export default function HeroSection({ photos, loading = false, error = null, onRetry }: HeroSectionProps) {
  const { activePhoto, hasMultiplePhotos, goToPreviousPhoto, goToNextPhoto } = useHeroPhotoCarousel({ photos });

  return (
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
              Since 2022, Be Original has supported over 140 youth across Sandwich Towne and Windsor by providing a safe
              space, mentorship as well as programming focused on life skills and career readiness.
            </p>
          </div>
        </div>
        <div className="hero-visual-panel">
          <div className="hero-visual-card">
            <div className="hero-photo-frame">
              {loading ? (
                <div className="hero-photo-state hero-photo-loading" role="status">
                  <LoadingSpinner />
                  Loading photos…
                </div>
              ) : error ? (
                <div className="hero-photo-state" role="alert">
                  <span>Photos couldn’t load.</span>
                  {onRetry && (
                    <Button size="sm" variant="secondary" onClick={onRetry}>
                      Retry
                    </Button>
                  )}
                </div>
              ) : activePhoto ? (
                <>
                  <HeroPhoto key={`${activePhoto.src}:${activePhoto.mobileSrc ?? ''}`} photo={activePhoto} />
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
                </>
              ) : (
                <div className="hero-photo-state" role="status">No photos available.</div>
              )}
            </div>
            <p className="hero-photo-caption" aria-hidden={loading || Boolean(error) || !activePhoto}>
              {!loading && !error && activePhoto ? activePhoto.caption : '\u00a0'}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
