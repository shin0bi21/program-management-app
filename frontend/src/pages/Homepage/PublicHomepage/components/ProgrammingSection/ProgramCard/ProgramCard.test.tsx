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
  it('formats the program age range', () => {
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

    expect(screen.getByText('Ages 12–15')).toBeInTheDocument();
  });

  it('shows all ages when age bounds are absent', () => {
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

    render(<ProgramCard program={program} />);

    expect(screen.getByText('All Ages')).toBeInTheDocument();
  });
});
