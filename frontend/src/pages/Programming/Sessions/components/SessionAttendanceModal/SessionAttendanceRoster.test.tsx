import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import SessionAttendanceRoster from './SessionAttendanceRoster';

const roster = [{
  youthId: 'youth-1',
  firstName: 'Maya',
  lastName: 'Thompson',
  status: 'present' as const,
  notes: null,
}];

describe('SessionAttendanceRoster', () => {
  it('renders loading and roster-specific empty states', () => {
    const view = render(<SessionAttendanceRoster
      loading
      roster={[]}
      selections={{}}
      disabled={false}
      onStatusChange={vi.fn()}
    />);

    expect(screen.getByText('Loading roster…')).toBeInTheDocument();

    view.rerender(<SessionAttendanceRoster
      loading={false}
      roster={[]}
      selections={{}}
      disabled={false}
      onStatusChange={vi.fn()}
    />);
    expect(screen.getByText('No youth were enrolled for this session.')).toBeInTheDocument();
  });

  it('forwards enrolled status changes and disables the control while saving', () => {
    const onStatusChange = vi.fn();
    const view = render(<SessionAttendanceRoster
      loading={false}
      roster={roster}
      selections={{ 'youth-1': 'present' }}
      disabled={false}
      onStatusChange={onStatusChange}
    />);

    fireEvent.click(screen.getByRole('button', { name: 'Attendance for Maya Thompson' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Late' }));
    expect(onStatusChange).toHaveBeenCalledWith('youth-1', 'late');

    view.rerender(<SessionAttendanceRoster
      loading={false}
      roster={roster}
      selections={{ 'youth-1': 'late' }}
      disabled
      onStatusChange={onStatusChange}
    />);
    expect(screen.getByRole('button', { name: 'Attendance for Maya Thompson' })).toBeDisabled();
  });
});
