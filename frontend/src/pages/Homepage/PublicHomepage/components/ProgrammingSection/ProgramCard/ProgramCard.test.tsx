import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HomepageProgram } from '../../../types';
import ProgramCard from './ProgramCard';

const program: HomepageProgram = {
  id: 'program-1', name: 'Future Ready', description: 'Build confidence and communication skills.',
  enrollmentRequired: true, minAge: 12, maxAge: 15,
  sessions: [
    { id: 'session-1', theme: 'Communication', date: '2026-11-10', startTime: '17:00', endTime: '19:00' },
    { id: 'session-2', theme: 'Cooking', date: '2026-11-11', startTime: '17:00', endTime: '19:00' },
    { id: 'session-3', theme: 'Careers', date: '2026-11-12', startTime: '17:00', endTime: '19:00' },
  ],
};

describe('ProgramCard', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 10, 21));
  });

  afterEach(() => vi.useRealTimers());

  it('renders saved dates and counts days from local today', () => {
    render(<ProgramCard program={program} />);

    const rows = within(screen.getByRole('list', { name: 'Upcoming sessions' })).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('10NovCommunicationToday');
    expect(rows[1]).toHaveTextContent('11NovCookingTomorrow');
    expect(rows[2]).toHaveTextContent('12NovCareersIn 2 days');
    expect(rows[0].querySelector('time')).toHaveAttribute('datetime', '2026-11-10');
    expect(screen.getByText('Ages 12–15')).toBeInTheDocument();
  });

  it('labels open attendance as drop-in days with unrestricted ages', () => {
    render(<ProgramCard program={{ ...program, enrollmentRequired: false, minAge: null, maxAge: null,
      sessions: program.sessions.slice(0, 1) }} />);

    expect(screen.getByText('All Ages')).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Upcoming drop-in days' })).getByText('Drop-in Day')).toBeInTheDocument();
  });
});
