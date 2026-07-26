import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DashboardCard, DashboardCardGroup } from './DashboardCard';

describe('DashboardCard', () => {
  it('renders an explicit empty state inside every card', () => {
    render(<DashboardCard title="Attendance" emptyMessage="No profile selected." />);

    expect(screen.getByRole('heading', { name: 'Attendance' })).toBeInTheDocument();
    expect(screen.getByText('No profile selected.')).toHaveClass('dashboard-card__empty');
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
