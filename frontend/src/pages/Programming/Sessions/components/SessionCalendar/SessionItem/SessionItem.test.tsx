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
    expect(item).toHaveClass('selected');
    expect(item).toHaveAccessibleName(/Cancelled/);
    fireEvent.mouseEnter(item);

    const details = await screen.findByRole('tooltip');
    expect(within(details).getByText('Future Ready')).toBeInTheDocument();
    expect(within(details).getByText('Summer 2026')).toBeInTheDocument();
    expect(within(details).getByText('Guest Speaker')).toBeInTheDocument();
    expect(within(details).getByText('Cancelled')).toBeInTheDocument();
    expect(within(details).getByText('Meet a local employer.')).toBeInTheDocument();
    expect(details).toHaveTextContent('Aug 10, 2026, 1:00 p.m.');
    expect(details).toHaveTextContent('Aug 10, 2026, 3:00 p.m.');
  });
});
