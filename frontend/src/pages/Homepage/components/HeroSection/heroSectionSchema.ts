export type HeroPhoto = {
  src: string
  mobileSrc?: string
  alt: string
  caption: string
}

export type HeroSectionProps = {
  photos: HeroPhoto[]
}
