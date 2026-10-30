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

  it('shows loading while photos load', () => {
    render(<HeroSection photos={[]} loading />)

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
})
