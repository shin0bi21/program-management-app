import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { makeProgramSession } from '../../../../../../tests/factories/session';
import SessionItem from './SessionItem';

describe('SessionItem', () => {
  it('shows only the title on the bar and gives type, saved times, cycle, status and description in its details', async () => {
    const session = makeProgramSession({
      date: '2026-12-21', startTime: '17:00', endTime: '19:30',
      sessionType: 'Guest Speaker', state: 'cancelled',
      cancelledAt: '2026-08-09T12:00:00Z', description: 'Meet a local employer.',
    });
    render(<SessionItem session={session} selected />);

    const item = screen.getByRole('button', { name: /Communication, Future Ready, Summer 2026, Guest Speaker/ });
    expect(item).toHaveTextContent(/^Communication$/);
    expect(item).toHaveAccessibleName(/Dec 21, 2026, 5:00.*7:30.*Cancelled/);
    fireEvent.mouseEnter(item);

    const details = await screen.findByRole('tooltip');
    expect(within(details).getByText('Future Ready')).toBeInTheDocument();
    expect(within(details).getByText('Summer 2026')).toBeInTheDocument();
    expect(within(details).getByText('Guest Speaker')).toBeInTheDocument();
    expect(within(details).getByText('Meet a local employer.')).toBeInTheDocument();
    expect(details).toHaveTextContent(/Dec 21, 2026.*5:00\s*p\.m\..*7:30\s*p\.m\./);
  });
});
