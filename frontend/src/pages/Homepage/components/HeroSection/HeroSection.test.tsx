import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
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
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the active photo and caption', () => {
    render(<HeroSection photos={photos} />)

    expect(screen.getByAltText('First hero photo')).toBeInTheDocument()
    expect(document.querySelector('source')).toHaveAttribute('srcset', '/programming/photo-1-mobile.webp')
    expect(screen.getByText('First caption.')).toBeInTheDocument()
  })

  it('keeps the hero image frame present while photos load', () => {
    const { container } = render(<HeroSection photos={[]} loading />)

    expect(screen.getByRole('region', { name: 'Organization branding' })).toBeInTheDocument()
    expect(container.querySelector('.hero-photo-frame')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Loading photos…')
  })

  it('shows a retry action when photos fail to load', () => {
    const onRetry = vi.fn()
    render(<HeroSection photos={[]} error="Network error" onRetry={onRetry} />)

    expect(screen.getByRole('alert')).toHaveTextContent('Photos couldn’t load.')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledOnce()
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

  it('preloads the neighboring carousel photo', () => {
    const preloadedSources: string[] = []
    class MockImage {
      set src(value: string) {
        preloadedSources.push(value)
      }
    }
    vi.stubGlobal('Image', MockImage)

    render(<HeroSection photos={photos} />)

    expect(preloadedSources).toContain('/programming/photo-2.png')
  })

  it('falls back from a failed mobile source and reports when the display image also fails', () => {
    render(<HeroSection photos={photos} />)

    const image = screen.getByAltText('First hero photo')
    fireEvent.error(image)
    expect(document.querySelector('source')).not.toBeInTheDocument()
    expect(screen.getByAltText('First hero photo')).toHaveAttribute('src', '/programming/photo-1.png')

    fireEvent.error(screen.getByAltText('First hero photo'))
    expect(screen.getByRole('status')).toHaveTextContent('Photo unavailable')
  })
})
