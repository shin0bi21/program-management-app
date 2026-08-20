// Scope: verifies Hours dashboard-card summaries, breakdowns, and empty presentation.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import TimesheetDashboardCard from './TimesheetDashboardCard';

describe('TimesheetDashboardCard', () => {
  it('opens the task breakdown in a modal', async () => {
    const user = userEvent.setup();

    render(
      <TimesheetDashboardCard
        title="Hours This Pay Period"
        total={7.25}
        modalTitle="Jordan Lee"
        modalSubtitle="Jul 29 – Aug 11, 2026"
        breakdown={[
          ['Program Delivery', 5],
          ['Meeting', 2.25],
        ]}
        emptyMessage="Select a time entry."
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
    expect(within(dialog).getByText('7.25')).toBeInTheDocument();
    expect(within(dialog).queryByText('hrs')).not.toBeInTheDocument();
    expect(within(dialog).getByText('Jul 29 – Aug 11, 2026')).toBeInTheDocument();
    expect(within(dialog).getByRole('img', { name: 'Breakdown of 7.25 hours' })).toBeInTheDocument();
    expect(within(dialog).getByText('Total').parentElement).toHaveTextContent('7.25');

    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the empty state without a breakdown action when no staff member is selected', () => {
    render(
      <TimesheetDashboardCard
        title="Average Biweekly Hours This Cycle"
        emptyMessage="Select a time entry."
      />,
    );

    expect(screen.getByText('Select a time entry.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'See Breakdown' })).not.toBeInTheDocument();
  });

  it('uses compact dashboard typography for a visible pay-period range', () => {
    render(
      <TimesheetDashboardCard
        title="Hours This Pay Period"
        total={7.25}
        modalTitle="Jordan Lee"
        modalSubtitle="Jul 29 – Aug 11, 2026"
        breakdown={[]}
        emptyMessage="Select a time entry."
        details={[
          ['Current Pay Period', 'Jul 29 – Aug 11, 2026'],
          ['Hours', '7.25'],
        ]}
      />,
    );

    const dateRange = screen.getByText('Jul 29 – Aug 11, 2026');
    expect(dateRange).toHaveClass('timesheet-overview-card__text-value');
    const layout = dateRange.closest('.timesheet-overview-card__layout')!;
    expect(layout.firstElementChild).toHaveClass('timesheet-overview-card__details');
    expect(layout.lastElementChild).toHaveClass('timesheet-overview-card__action');
  });

  it('uses compact text sizing for cycle names while keeping averages prominent', () => {
    render(
      <TimesheetDashboardCard
        title="Average Biweekly Hours"
        total={0.33}
        modalTitle="Jordan Lee"
        modalSubtitle="Summer 2026"
        breakdown={[]}
        emptyMessage="Select a time entry."
        details={[
          ['Cycle', 'Summer 2026'],
          ['Biweekly Average', '0.33'],
        ]}
      />,
    );

    expect(screen.getByText('Summer 2026')).toHaveClass('timesheet-overview-card__text-value');
    expect(screen.getByText('0.33')).not.toHaveClass('timesheet-overview-card__text-value');
  });
});
