type ResourceCardProps = {
  name: string
  role: string
  bio: string
  badge?: string
  education?: string
  school?: string
  imageSrc?: string
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
  imageAlt,
}: ResourceCardProps) {
  const initial = name.charAt(0).toUpperCase();

  return (
    <article className="resource-card">
      <header className="resource-header">
        <div className="resource-photo-panel">
          {imageSrc ? (
            <img className="resource-photo" src={imageSrc} alt={imageAlt || name} />
          ) : (
            <div className="resource-photo resource-photo-placeholder">
              <span>{initial}</span>
            </div>
          )}
        </div>
        <div className="resource-heading">
          <h3 className="resource-name">{name}</h3>
          <p className="resource-role">
            {badge ? `${badge}, ${role}` : role}
          </p>
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
