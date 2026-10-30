import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { makeCohortSession } from '../../../../../../tests/factories/session';
import SessionItem from './SessionItem';

describe('SessionItem', () => {
  it('shows only the theme on the bar and gives type, Toronto times, cohort, status and description in its details', async () => {
    const session = makeCohortSession({
      sessionTypeName: 'Guest Speaker', state: 'cancelled',
      cancelledAt: '2026-08-09T12:00:00Z', description: 'Meet a local employer.',
    });
    render(<SessionItem session={session} selected />);

    const item = screen.getByRole('button', { name: /Communication, Future Ready, Summer 2026, Guest Speaker/ });
    expect(item).toHaveTextContent(/^Communication$/);
    expect(item).toHaveAccessibleName(/Cancelled/);
    fireEvent.mouseEnter(item);

    const details = await screen.findByRole('tooltip');
    expect(within(details).getByText('Future Ready')).toBeInTheDocument();
    expect(within(details).getByText('Summer 2026')).toBeInTheDocument();
    expect(within(details).getByText('Guest Speaker')).toBeInTheDocument();
    expect(within(details).getByText('Meet a local employer.')).toBeInTheDocument();
    expect(within(details).getByText('Date')).toBeInTheDocument();
    expect(details).toHaveTextContent(/Aug 10, 1\s*–\s*3\s*p\.m\./);
    expect(within(details).queryByText('Starts')).not.toBeInTheDocument();
    expect(within(details).queryByText('Ends')).not.toBeInTheDocument();
  });
  it('keeps both local dates when a session crosses midnight', async () => {
    render(<SessionItem session={makeCohortSession({
      startsAt: '2026-12-22T04:00:00Z', endsAt: '2026-12-22T06:30:00Z',
    })} />);
    fireEvent.mouseEnter(screen.getByRole('button', { name: /Communication/ }));
    const details = await screen.findByRole('tooltip');
    expect(details).toHaveTextContent(/Dec 21, 11\s*p\.m\./);
    expect(details).toHaveTextContent(/Dec 22, 1:30\s*a\.m\./);
  });
});
