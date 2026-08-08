import { useState } from 'react'
import type { HeroPhoto as HeroPhotoData } from './heroSectionSchema'

type HeroPhotoProps = {
  photo: HeroPhotoData
}

export default function HeroPhoto({ photo }: HeroPhotoProps) {
  const [useMobileSource, setUseMobileSource] = useState(Boolean(photo.mobileSrc))
  const [unavailable, setUnavailable] = useState(false)

  if (unavailable) {
    return (
      <div className="hero-photo-unavailable" role="status">
        Photo unavailable
      </div>
    )
  }

  return (
    <picture>
      {useMobileSource && photo.mobileSrc && (
        <source media="(max-width: 820px)" srcSet={photo.mobileSrc} />
      )}
      <img
        src={photo.src}
        alt={photo.alt}
        className="hero-photo-image"
        loading="eager"
        onError={() => {
          if (useMobileSource) {
            setUseMobileSource(false)
            return
          }
          setUnavailable(true)
        }}
      />
    </picture>
  )
}
