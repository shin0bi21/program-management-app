import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ProgrammingSection from './ProgrammingSection'
import { programs } from './programmingSectionData'

describe('ProgrammingSection', () => {
  it('renders the section heading and one card per program', () => {
    const { container } = render(<ProgrammingSection />)

    expect(screen.getByRole('heading', { name: /programming/i })).toBeInTheDocument()
    expect(container.querySelectorAll('.program-card')).toHaveLength(programs.length)
  })
})
