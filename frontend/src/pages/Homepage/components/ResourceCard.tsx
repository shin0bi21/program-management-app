type ResourceCardProps = {
  name: string
  role: string
  bio: string
  imageSrc?: string
  imageAlt?: string
  reverseLayout?: boolean
}

export default function ResourceCard({
  name,
  role,
  bio,
  imageSrc,
  imageAlt,
  reverseLayout = false,
}: ResourceCardProps) {
  return (
    <article className={`resource-card${reverseLayout ? ' resource-card-reverse' : ''}`}>
      <div className="resource-photo-panel">
        {imageSrc ? (
          <img className="resource-photo" src={imageSrc} alt={imageAlt || name} />
        ) : (
          <div className="resource-photo resource-photo-placeholder">
            <span>Photo Placeholder</span>
          </div>
        )}
      </div>

      <div className="resource-content">
        <h3 className="resource-name">{name}</h3>
        <p className="resource-role">{role}</p>
        <p className="resource-bio">{bio}</p>
      </div>
    </article>
  )
}
