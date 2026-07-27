import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { HomepageSession } from '../../../api/homepage.api';
import ProgramCard from './ProgramCard';
import type { Program } from './programCardSchema';

const session: HomepageSession = {
  id: 'session-1',
  cohortId: 'cohort-1',
  theme: 'Guest Speaker',
  description: null,
  startsAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
  endsAt: new Date(Date.now() + 2 * 86_400_000 + 7_200_000).toISOString(),
  cohortName: 'Summer 2026',
  programId: 'program-1',
  programName: 'Soft Skills',
  programDescription: 'Build confidence and communication skills.',
  rosterMode: 'enrolled',
  minAge: 12,
  maxAge: 15,
  addedAt: new Date().toISOString(),
};

describe('ProgramCard', () => {
  it('keeps program details and renders its next database session', () => {
    const program: Program = {
      programName: 'Soft Skills',
      age: 'Ages 12–15',
      day: 'Every Tuesday',
      title: 'Soft Skills Program',
      copy: 'Build confidence and communication skills.',
    };
    render(<ProgramCard program={program} sessions={[session]} />);

    expect(screen.getByText('Every Tuesday')).toBeInTheDocument();
    expect(screen.getByText('Soft Skills Program')).toBeInTheDocument();
    expect(screen.getByText('Ages 12–15')).toBeInTheDocument();
    expect(screen.getByText('Build confidence and communication skills.')).toBeInTheDocument();
    expect(screen.queryByText('Summer 2026')).not.toBeInTheDocument();
    expect(screen.getByText('Guest Speaker')).toBeInTheDocument();
  });
});
