import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DashboardCard } from './DashboardCard';

describe('DashboardCard', () => {
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

  it('retains compact detail labels while values load and preserves zero and unavailable values', () => {
    const view = render(<DashboardCard
      title="Hours summary"
      details={[{ label: 'Cycle', value: 'Summer' }, { label: 'Hours', value: null }]}
    >Hours unavailable</DashboardCard>);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('Hours unavailable')).toBeInTheDocument();

    view.rerender(<DashboardCard
      title="Hours summary"
      loading
      details={[{ label: 'Cycle', value: 'Summer' }, { label: 'Hours', value: 12 }]}
    >Hours unavailable</DashboardCard>);

    expect(screen.getByText('Cycle')).toBeInTheDocument();
    expect(screen.getByText('Hours')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Loading hours…' })).toBeInTheDocument();
    expect(screen.queryByText('Summer')).not.toBeInTheDocument();
    expect(screen.queryByText('12')).not.toBeInTheDocument();
    expect(screen.queryByText('Hours unavailable')).not.toBeInTheDocument();

    view.rerender(<DashboardCard title="Hours summary" details={[{ label: 'Hours', value: 0 }]} />);

    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
