// Owns session-note roster loading, error, empty, selection, and disabled states.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import SessionYouthChecklist from './SessionYouthChecklist';

const roster = [
  { youthId: 'youth-1', firstName: 'Maya', lastName: 'Thompson', status: null, notes: null },
];

describe('SessionYouthChecklist', () => {
  it('renders loading, error, and roster-mode empty states', () => {
    const props = {
      roster: [],
      selectedYouthIds: [],
      disabled: false,
      onToggle: vi.fn(),
    } as const;
    const view = render(
      <SessionYouthChecklist {...props} rosterMode="enrolled" loading error={undefined} />,
    );
    expect(screen.getByText('Loading youth…')).toBeInTheDocument();

    view.rerender(
      <SessionYouthChecklist {...props} rosterMode="enrolled" loading={false} error="Roster failed" />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Roster failed');

    view.rerender(
      <SessionYouthChecklist {...props} rosterMode="open" loading={false} error={undefined} />,
    );
    expect(screen.getByText('No youth have checked into this session yet.')).toBeInTheDocument();

    view.rerender(
      <SessionYouthChecklist {...props} rosterMode="enrolled" loading={false} error={undefined} />,
    );
    expect(screen.getByText('No youth are enrolled in this cohort.')).toBeInTheDocument();
  });

  it('renders checked state, forwards toggles, and disables the completed form', () => {
    const onToggle = vi.fn();
    const view = render(
      <SessionYouthChecklist
        rosterMode="enrolled"
        roster={roster}
        selectedYouthIds={['youth-1']}
        loading={false}
        disabled
        onToggle={onToggle}
      />,
    );

    const checkbox = screen.getByRole('checkbox', { name: 'Maya Thompson' });
    expect(checkbox).toBeChecked();
    expect(checkbox).toBeDisabled();

    view.rerender(
      <SessionYouthChecklist
        rosterMode="enrolled"
        roster={roster}
        selectedYouthIds={['youth-1']}
        loading={false}
        disabled={false}
        onToggle={onToggle}
      />,
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'Maya Thompson' }));
    expect(onToggle).toHaveBeenCalledWith('youth-1');
  });
});
