import { useEffect, useState } from 'react';
import type { HeroPhoto } from './heroSectionSchema'

const HERO_PHOTO_INTERVAL_MS = 10000

type UseHeroPhotoCarouselOptions = {
  photos: HeroPhoto[]
}

export function useHeroPhotoCarousel({ photos }: UseHeroPhotoCarouselOptions) {
  const [photoIndex, setPhotoIndex] = useState(0)
  const activePhoto = photos[photoIndex] ?? photos[0] ?? null
  const hasMultiplePhotos = photos.length > 1

  useEffect(() => {
    setPhotoIndex(0)
  }, [photos])

  useEffect(() => {
    if (!hasMultiplePhotos) return

    const mobileViewport = typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 820px)').matches
      : window.innerWidth <= 820
    const adjacentIndexes = new Set([
      (photoIndex + 1) % photos.length,
      (photoIndex - 1 + photos.length) % photos.length,
    ])

    adjacentIndexes.forEach((index) => {
      const photo = photos[index]
      const preloader = new window.Image()
      preloader.src = mobileViewport && photo.mobileSrc ? photo.mobileSrc : photo.src
    })
  }, [hasMultiplePhotos, photoIndex, photos])

  useEffect(() => {
    if (!hasMultiplePhotos) return

    const intervalId = window.setInterval(() => {
      setPhotoIndex((current) => (current + 1) % photos.length)
    }, HERO_PHOTO_INTERVAL_MS)

    return () => window.clearInterval(intervalId)
  }, [hasMultiplePhotos, photos.length])

  const goToPreviousPhoto = () => {
    if (!photos.length) return
    setPhotoIndex((current) => (current - 1 + photos.length) % photos.length)
  }

  const goToNextPhoto = () => {
    if (!photos.length) return
    setPhotoIndex((current) => (current + 1) % photos.length)
  }

  return {
    activePhoto,
    hasMultiplePhotos,
    goToPreviousPhoto,
    goToNextPhoto,
  }
}
