import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import YouthNotesDashboardCard from './YouthNotesDashboardCard';

describe('YouthNotesDashboardCard', () => {
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
