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
      isOpenRoster={false}
      roster={[]}
      selections={{}}
      disabled={false}
      onRemove={vi.fn()}
      onStatusChange={vi.fn()}
    />);

    expect(screen.getByText('Loading roster…')).toBeInTheDocument();

    view.rerender(<SessionAttendanceRoster
      loading={false}
      isOpenRoster
      roster={[]}
      selections={{}}
      disabled={false}
      onRemove={vi.fn()}
      onStatusChange={vi.fn()}
    />);
    expect(screen.getByText('No youth have checked in yet.')).toBeInTheDocument();

    view.rerender(<SessionAttendanceRoster
      loading={false}
      isOpenRoster={false}
      roster={[]}
      selections={{}}
      disabled={false}
      onRemove={vi.fn()}
      onStatusChange={vi.fn()}
    />);
    expect(screen.getByText('No youth were enrolled for this session.')).toBeInTheDocument();
  });

  it('forwards enrolled status changes and disables the control while saving', () => {
    const onStatusChange = vi.fn();
    const view = render(<SessionAttendanceRoster
      loading={false}
      isOpenRoster={false}
      roster={roster}
      selections={{ 'youth-1': 'present' }}
      disabled={false}
      onRemove={vi.fn()}
      onStatusChange={onStatusChange}
    />);

    fireEvent.click(screen.getByRole('button', { name: 'Attendance for Maya Thompson' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Late' }));
    expect(onStatusChange).toHaveBeenCalledWith('youth-1', 'late');

    view.rerender(<SessionAttendanceRoster
      loading={false}
      isOpenRoster={false}
      roster={roster}
      selections={{ 'youth-1': 'late' }}
      disabled
      onRemove={vi.fn()}
      onStatusChange={onStatusChange}
    />);
    expect(screen.getByRole('button', { name: 'Attendance for Maya Thompson' })).toBeDisabled();
  });

  it('forwards open-roster removal and disables it while saving', () => {
    const onRemove = vi.fn();
    const view = render(<SessionAttendanceRoster
      loading={false}
      isOpenRoster
      roster={roster}
      selections={{}}
      disabled={false}
      onRemove={onRemove}
      onStatusChange={vi.fn()}
    />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onRemove).toHaveBeenCalledWith('youth-1');

    view.rerender(<SessionAttendanceRoster
      loading={false}
      isOpenRoster
      roster={roster}
      selections={{}}
      disabled
      onRemove={onRemove}
      onStatusChange={vi.fn()}
    />);
    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled();
  });
});
