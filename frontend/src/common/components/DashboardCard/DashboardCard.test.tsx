import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DashboardCard, DashboardCardGroup } from './DashboardCard';

describe('DashboardCard', () => {
  it('renders an explicit empty state inside every card', () => {
    render(<DashboardCard title="Attendance" emptyMessage="No profile selected." />);

    expect(screen.getByRole('heading', { name: 'Attendance' })).toBeInTheDocument();
    expect(screen.getByText('No profile selected.')).toHaveClass('dashboard-card__empty');
  });

  it('renders an optional action in the card header', () => {
    render(
      <DashboardCard title="Primary Contact" action={<button type="button">+ Add</button>} />,
    );

    const heading = screen.getByRole('heading', { name: 'Primary Contact' });
    const action = screen.getByRole('button', { name: '+ Add' });
    expect(heading.parentElement).toContainElement(action);
  });

  it('keeps the card and header mounted while only its data region loads', () => {
    const view = render(<DashboardCard title="Notes" action={<button disabled>+ Add</button>} loading loadingLabel="Loading notes…">Old record notes</DashboardCard>);
    const heading = screen.getByRole('heading', { name: 'Notes' });
    const card = heading.closest('article');

    expect(screen.getByRole('status', { name: 'Loading notes…' })).toBeInTheDocument();
    expect(card).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText('Old record notes')).not.toBeInTheDocument();

    view.rerender(<DashboardCard title="Notes" action={<button>+ Add</button>}>New record notes</DashboardCard>);

    expect(screen.getByRole('heading', { name: 'Notes' })).toBe(heading);
    expect(heading.closest('article')).toBe(card);
    expect(card).toHaveAttribute('aria-busy', 'false');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText('New record notes')).toBeInTheDocument();
  });

  it('groups dashboard cards under an accessible region', () => {
    render(
      <DashboardCardGroup ariaLabel="Cohort overview">
        <DashboardCard title="Youth enrolled"><strong>12</strong></DashboardCard>
        <DashboardCard title="Next session"><strong>Jul 28</strong></DashboardCard>
      </DashboardCardGroup>,
    );

    const group = screen.getByRole('region', { name: 'Cohort overview' });
    expect(group).toContainElement(screen.getByRole('heading', { name: 'Youth enrolled' }));
    expect(group).toContainElement(screen.getByRole('heading', { name: 'Next session' }));
  });
});
