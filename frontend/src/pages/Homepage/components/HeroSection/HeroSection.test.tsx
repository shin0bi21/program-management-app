import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import HeroSection from './HeroSection'
import type { HeroPhoto } from './heroSectionSchema'

const photos: HeroPhoto[] = [
  {
    src: '/programming/photo-1.png',
    mobileSrc: '/programming/photo-1-mobile.webp',
    alt: 'First hero photo',
    caption: 'First caption.',
  },
  {
    src: '/programming/photo-2.png',
    alt: 'Second hero photo',
    caption: 'Second caption.',
  },
]

describe('HeroSection', () => {
  it('renders the active photo and caption', () => {
    render(<HeroSection photos={photos} />)

    expect(screen.getByAltText('First hero photo')).toBeInTheDocument()
    expect(document.querySelector('source')).toHaveAttribute('srcset', '/programming/photo-1-mobile.webp')
    expect(screen.getByText('First caption.')).toBeInTheDocument()
  })

  it('moves between photos with the navigation buttons', () => {
    render(<HeroSection photos={photos} />)

    fireEvent.click(screen.getByRole('button', { name: /show next photo/i }))
    expect(screen.getByAltText('Second hero photo')).toBeInTheDocument()
    expect(screen.getByText('Second caption.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /show previous photo/i }))
    expect(screen.getByAltText('First hero photo')).toBeInTheDocument()
    expect(screen.getByText('First caption.')).toBeInTheDocument()
  })
})
