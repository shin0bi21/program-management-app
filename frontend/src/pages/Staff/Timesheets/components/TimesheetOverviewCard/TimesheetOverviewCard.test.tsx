import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import TimesheetOverviewCard from './TimesheetOverviewCard';

describe('TimesheetOverviewCard', () => {
  it('opens the task breakdown in a modal', async () => {
    const user = userEvent.setup();

    render(
      <TimesheetOverviewCard
        title="Hours This Pay Period"
        total={7.25}
        modalTitle="Jordan Lee"
        modalSubtitle="Jul 29 – Aug 11, 2026"
        breakdown={[
          ['Program Delivery', 5],
          ['Meeting', 2.25],
        ]}
        emptyMessage="Select a time entry."
        hasStaff
      />,
    );

    const card = screen.getByRole('heading', { name: 'Hours This Pay Period' }).closest('article');
    expect(card).not.toBeNull();
    const cardQueries = within(card!);

    expect(cardQueries.getByText('7.25')).toBeInTheDocument();
    expect(cardQueries.queryByText('Program Delivery')).not.toBeInTheDocument();

    const toggle = cardQueries.getByRole('button', { name: 'See Breakdown' });
    expect(toggle).toHaveAttribute('aria-haspopup', 'dialog');
    await user.click(toggle);

    const dialog = screen.getByRole('dialog', { name: 'Jordan Lee' });
    expect(within(dialog).getByText('Program Delivery')).toBeInTheDocument();
    expect(within(dialog).getByText('5.00')).toBeInTheDocument();
    expect(within(dialog).getAllByText('7.25')).toHaveLength(2);
    expect(within(dialog).getByText('hrs')).toBeInTheDocument();
    expect(within(dialog).getByText('Jul 29 – Aug 11, 2026')).toBeInTheDocument();
    expect(within(dialog).getByRole('img', { name: 'Breakdown of 7.25 hours' })).toBeInTheDocument();
    expect(within(dialog).getByText('Total').parentElement).toHaveTextContent('7.25');

    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the empty state without a breakdown action when no staff member is selected', () => {
    render(
      <TimesheetOverviewCard
        title="Average Biweekly Hours This Cycle"
        total={0}
        modalTitle=""
        modalSubtitle=""
        breakdown={[]}
        emptyMessage="Select a time entry."
        hasStaff={false}
      />,
    );

    expect(screen.getByText('Select a time entry.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'See Breakdown' })).not.toBeInTheDocument();
  });
});
