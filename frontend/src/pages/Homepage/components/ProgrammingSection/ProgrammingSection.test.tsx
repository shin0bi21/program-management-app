import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { HomepageSession } from '../../api/homepage.api';
import ProgrammingSection from './ProgrammingSection';

const sessions = [
  {
    id: 'session-1',
    cohortId: 'cohort-1',
    theme: 'Communication',
    description: null,
    startsAt: '2026-08-04T21:00:00.000Z',
    endsAt: '2026-08-04T23:00:00.000Z',
    cohortName: 'Summer 2026',
    programId: 'program-1',
    programName: 'Soft Skills',
    programDescription: 'Build communication skills.',
    rosterMode: 'enrolled',
    minAge: 12,
    maxAge: 15,
    addedAt: '2026-07-27T12:00:00.000Z',
  },
] satisfies HomepageSession[];

describe('ProgrammingSection', () => {
  it('renders one card per homepage program without duplicating programs by session', () => {
    const { container } = render(<ProgrammingSection sessions={sessions} />);

    expect(screen.getByRole('heading', { name: /programming/i })).toBeInTheDocument();
    expect(container.querySelectorAll('.program-card')).toHaveLength(3);
    expect(screen.getAllByText('Soft Skills Program')).toHaveLength(1);
  });

  it('keeps all program cards when no sessions are scheduled', () => {
    render(<ProgrammingSection sessions={[]} />);
    expect(screen.getByText('Drop-in Days')).toBeInTheDocument();
    expect(screen.getByText('Soft Skills Program')).toBeInTheDocument();
    expect(screen.getByText('Job Readiness Program')).toBeInTheDocument();
  });
});
