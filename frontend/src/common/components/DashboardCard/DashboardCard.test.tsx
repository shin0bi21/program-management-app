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
});
