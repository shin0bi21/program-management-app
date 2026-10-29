import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { HomepageProgram, HomepageSession } from '../../../types';
import ProgramCard from './ProgramCard';

const session: HomepageSession = {
  id: 'session-1',
  theme: 'Guest Speaker',
  startsAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
};

describe('ProgramCard', () => {
  it('keeps program details and renders its next database session', () => {
    const program: HomepageProgram = {
      id: 'program-1',
      name: 'Future Ready',
      description: 'Build confidence and communication skills.',
      enrollmentRequired: true,
      minAge: 12,
      maxAge: 15,
      sessions: [session],
    };
    render(<ProgramCard program={program} />);

    expect(screen.getByRole('heading', { name: 'Future Ready' })).toBeInTheDocument();
    expect(screen.getByText('Ages 12–15')).toBeInTheDocument();
    expect(screen.getByText('Build confidence and communication skills.')).toBeInTheDocument();
    expect(screen.getByText('Guest Speaker')).toBeInTheDocument();
  });

  it('uses the same session structure for every upcoming date', () => {
    const sessions = [0, 1, 2].map((week) => ({
      ...session,
      id: `session-${week}`,
      startsAt: new Date(Date.now() + (week + 1) * 7 * 86_400_000).toISOString(),
    }));
    const program: HomepageProgram = {
      id: 'program-1',
      name: 'Drop In',
      description: 'Join the weekly drop-in.',
      enrollmentRequired: false,
      minAge: null,
      maxAge: null,
      sessions,
    };

    const { container } = render(<ProgramCard program={program} />);

    expect(screen.getByText('All Ages')).toBeInTheDocument();
    expect(container.querySelectorAll('.next-session')).toHaveLength(3);
    expect(container.querySelectorAll('.next-session-date')).toHaveLength(3);
    expect(container.querySelectorAll('.next-session-body')).toHaveLength(3);
    expect(container.querySelectorAll('.next-session--featured')).toHaveLength(1);
  });
});
