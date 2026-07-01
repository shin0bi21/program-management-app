import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ProgramCard from './ProgramCard'
import type { Program } from './programCardSchema'

function createDate(offsetDays: number) {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  return date
}

describe('ProgramCard', () => {
  it('renders program details and the next upcoming session', () => {
    const program: Program = {
      age: 'Ages 12-15',
      day: 'Every Tuesday',
      title: 'Soft Skills Program',
      copy: 'Build confidence and communication skills.',
      sessions: [
        { date: createDate(-2), topic: 'Past session' },
        { date: createDate(2), topic: 'Guest Speaker' },
      ],
    }

    render(<ProgramCard program={program} />)

    expect(screen.getByText('Every Tuesday')).toBeInTheDocument()
    expect(screen.getByText('Ages 12-15')).toBeInTheDocument()
    expect(screen.getByText('Soft Skills Program')).toBeInTheDocument()
    expect(screen.getByText('Build confidence and communication skills.')).toBeInTheDocument()
    expect(screen.getByText('Guest Speaker')).toBeInTheDocument()
  })

  it('shows the empty state when there are no upcoming sessions', () => {
    const program: Program = {
      age: 'Ages 16-19',
      day: 'Every Wednesday',
      title: 'Job Readiness Program',
      copy: 'Resume and interview prep.',
      sessions: [
        { date: createDate(-3), topic: 'Resume Review' },
      ],
    }

    render(<ProgramCard program={program} />)

    expect(screen.getByText(/all sessions complete for this cycle/i)).toBeInTheDocument()
  })
})
