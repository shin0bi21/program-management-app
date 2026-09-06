import type { ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { AttendanceYouth } from '../../types';
import OpenAttendancePicker from './OpenAttendancePicker';

const profile = {
  id: 'youth-1',
  firstName: 'Maya',
  lastName: 'Thompson',
} satisfies AttendanceYouth;

function renderPicker(overrides: Partial<ComponentProps<typeof OpenAttendancePicker>> = {}) {
  const props: ComponentProps<typeof OpenAttendancePicker> = {
    search: '',
    appliedSearch: '',
    searchResults: [],
    searching: false,
    disabled: false,
    onSearchChange: vi.fn(),
    onSearchApply: vi.fn(),
    onSearchClear: vi.fn(),
    onCheckIn: vi.fn(),
    ...overrides,
  };
  render(<OpenAttendancePicker {...props} />);
  return props;
}

describe('OpenAttendancePicker', () => {
  it('forwards search changes without showing premature results', () => {
    const props = renderPicker();

    fireEvent.change(screen.getByRole('textbox', { name: 'Find youth profile' }), {
      target: { value: 'M' },
    });
    expect(props.onSearchChange).toHaveBeenCalledWith('M');
    expect(screen.queryByLabelText('Youth profile results')).not.toBeInTheDocument();
  });

  it('renders search states and forwards check-in', () => {
    const props = renderPicker({ search: 'Ma', appliedSearch: 'Ma', searchResults: [profile] });

    fireEvent.click(screen.getByRole('button', { name: 'Check in' }));

    expect(screen.getByText('Maya Thompson')).toBeInTheDocument();
    expect(props.onCheckIn).toHaveBeenCalledWith(profile);
  });

  it('renders searching and empty-result states', () => {
    const view = render(<OpenAttendancePicker
      search="Ma"
      appliedSearch="Ma"
      searchResults={[]}
      searching
      disabled={false}
      onSearchChange={vi.fn()}
      onSearchApply={vi.fn()}
      onSearchClear={vi.fn()}
      onCheckIn={vi.fn()}
    />);
    expect(screen.getByText('Searching…')).toBeInTheDocument();

    view.rerender(<OpenAttendancePicker
      search="Ma"
      appliedSearch="Ma"
      searchResults={[]}
      searching={false}
      disabled={false}
      onSearchChange={vi.fn()}
      onSearchApply={vi.fn()}
      onSearchClear={vi.fn()}
      onCheckIn={vi.fn()}
    />);
    expect(screen.getByText('No matching profiles.')).toBeInTheDocument();
  });

  it('disables every action while attendance is saving', () => {
    renderPicker({ search: 'Ma', appliedSearch: 'Ma', searchResults: [profile], disabled: true });

    expect(screen.getByRole('textbox', { name: 'Find youth profile' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Check in' })).toBeDisabled();
  });
});
