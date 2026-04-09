type ResourceCardProps = {
  name: string
  role: string
  bio: string
  imageSrc?: string
  imageAlt?: string
}

export default function ResourceCard({
  name,
  role,
  bio,
  imageSrc,
  imageAlt,
}: ResourceCardProps) {
  const initial = name.charAt(0).toUpperCase();

  return (
    <article className="resource-card">
      <div className="resource-photo-panel">
        {imageSrc ? (
          <img className="resource-photo" src={imageSrc} alt={imageAlt || name} />
        ) : (
          <div className="resource-photo resource-photo-placeholder">
            <span>{initial}</span>
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
