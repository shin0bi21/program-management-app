type ResourceCardProps = {
  name: string
  role: string
  bio: string
  badge?: string
  education?: string
  school?: string
  imageSrc?: string
  imageMobileSrc?: string
  imageAlt?: string
}

export default function ResourceCard({
  name,
  role,
  bio,
  badge,
  education,
  school,
  imageSrc,
  imageMobileSrc,
  imageAlt,
}: ResourceCardProps) {
  const initial = name.charAt(0).toUpperCase();

  return (
    <article className="resource-card" role="listitem">
      <header className="resource-header">
        <div className="resource-photo-panel">
          {imageSrc ? (
            <picture>
              {imageMobileSrc && <source media="(max-width: 820px)" srcSet={imageMobileSrc} />}
              <img
                className="resource-photo"
                src={imageSrc}
                alt={imageAlt ?? ''}
                loading="lazy"
                decoding="async"
              />
            </picture>
          ) : (
            <div
              className="resource-photo resource-photo-placeholder"
              aria-hidden="true"
            >
              <span>{initial}</span>
            </div>
          )}
        </div>
        <div className="resource-heading">
          <h3 className="resource-name">{name}</h3>
          <p className="resource-role">{role}</p>
          {badge && <p className="resource-badge">{badge}</p>}
        </div>
      </header>

      <div className="resource-content">
        {(education || school) && (
          <p className="resource-education">
            {education}{education && school && ', '}{school}
          </p>
        )}
        <p className="resource-bio">{bio}</p>
      </div>
    </article>
  )
}
