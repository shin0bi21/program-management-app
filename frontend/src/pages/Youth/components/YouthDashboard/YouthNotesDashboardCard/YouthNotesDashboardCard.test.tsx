import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import YouthNotesDashboardCard from './YouthNotesDashboardCard';

describe('YouthNotesDashboardCard', () => {
  it('keeps the notes shell through loading and separates no selection from empty notes', () => {
    const onSelectProfileNote = vi.fn();
    const { rerender } = render(<YouthNotesDashboardCard selected={false} onSelectProfileNote={onSelectProfileNote} />);
    const card = screen.getByText('Profile Notes').closest('.dashboard-card');

    rerender(<YouthNotesDashboardCard selected profileNotesLoading onSelectProfileNote={onSelectProfileNote} />);

    expect(screen.getByRole('status', { name: 'Loading profile notes…' })).toBeInTheDocument();
    expect(screen.getByText('Profile Notes').closest('.dashboard-card')).toBe(card);
    expect(screen.queryByText('No profile notes recorded.')).not.toBeInTheDocument();

    rerender(<YouthNotesDashboardCard selected onSelectProfileNote={onSelectProfileNote} />);

    expect(screen.getByText('No profile notes recorded.')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('renders a neutral unavailable state for a page-reported query error', () => {
    render(<YouthNotesDashboardCard
      selected
      profileNotesError="Could not load profile notes."
      onSelectProfileNote={vi.fn()}
    />);

    expect(screen.getByText('Profile notes unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
