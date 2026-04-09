type AboutOrganizationCardProps = {
  eyebrow: string
  title?: string
  description: string
  highlight?: boolean
}

export default function AboutOrganizationCard({
  eyebrow,
  title,
  description,
  highlight = false,
}: AboutOrganizationCardProps) {
  return (
    <article className={`about-org-card${highlight ? ' about-org-card-highlight' : ''}`}>
      <p className="about-org-eyebrow">{eyebrow}</p>
      {title ? <h2 className="about-org-title">{title}</h2> : null}
      <p className="about-org-description">{description}</p>
    </article>
  )
}
