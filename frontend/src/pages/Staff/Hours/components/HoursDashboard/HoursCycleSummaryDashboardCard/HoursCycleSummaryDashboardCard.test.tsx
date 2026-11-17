import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getHoursCycleSummaryData } from '../../../hours.api';
import { renderWithQueryClient } from '../../../../../../tests/queryClientTestUtils';
import HoursCycleSummaryDashboardCard from './HoursCycleSummaryDashboardCard';

vi.mock('../../../hours.api', () => ({ getHoursCycleSummaryData: vi.fn() }));

const staff = {
  id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true,
};
const cycle = {
  id: 'cycle-1', title: 'Summer 2026', startsOn: '2026-07-01', endsOn: '2026-09-01', state: 'active',
} as const;
const baseProps = { queryKey: ['hours'], staff, cycles: [cycle] };
const cycleSummary = { periodCount: 2, averageHours: 9, breakdown: [{ label: 'Meeting', hours: 9 }] };

describe('HoursCycleSummaryDashboardCard', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getHoursCycleSummaryData).mockResolvedValue(cycleSummary);
  });

  it('uses the current cycle even when a completed cycle appears first', async () => {
    renderWithQueryClient(<HoursCycleSummaryDashboardCard
      {...baseProps}
      cycles={[{ ...cycle, id: 'completed-cycle', state: 'completed' }, cycle]}
    />);

    await screen.findByText('9.00');
    expect(getHoursCycleSummaryData).toHaveBeenCalledWith('staff-1', 'cycle-1', { signal: expect.any(AbortSignal) });
  });

  it('does not substitute a historical or upcoming cycle when none is active', () => {
    renderWithQueryClient(<HoursCycleSummaryDashboardCard
      {...baseProps}
      cycles={[{ ...cycle, state: 'completed' }, { ...cycle, id: 'next-cycle', state: 'upcoming' }]}
    />);

    expect(screen.getByText('No current cycle is available.')).toBeInTheDocument();
    expect(getHoursCycleSummaryData).not.toHaveBeenCalled();
  });

  it('waits for shared staff context before requesting the current cycle summary', async () => {
    const { rerender } = renderWithQueryClient(<HoursCycleSummaryDashboardCard
      {...baseProps}
      staff={null}
    />);
    expect(getHoursCycleSummaryData).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'See Breakdown' })).toBeDisabled();

    rerender(<HoursCycleSummaryDashboardCard {...baseProps} />);

    await screen.findByText('9.00');
    expect(getHoursCycleSummaryData).toHaveBeenCalledWith('staff-1', 'cycle-1', { signal: expect.any(AbortSignal) });
  });

  it('follows a new current cycle and closes the previous cycle breakdown', async () => {
    const { rerender } = renderWithQueryClient(<HoursCycleSummaryDashboardCard {...baseProps} />);
    await screen.findByText('9.00');
    fireEvent.click(screen.getByRole('button', { name: 'See Breakdown' }));
    expect(screen.getByRole('dialog', { name: 'Zoe Wilson' })).toBeInTheDocument();
    vi.mocked(getHoursCycleSummaryData).mockResolvedValue({ ...cycleSummary, averageHours: 6 });

    rerender(<HoursCycleSummaryDashboardCard
      {...baseProps}
      cycles={[{ ...cycle, state: 'completed' }, { ...cycle, id: 'cycle-2', title: 'Fall 2026' }]}
    />);

    expect(await screen.findByText('6.00')).toBeInTheDocument();
    expect(getHoursCycleSummaryData).toHaveBeenLastCalledWith('staff-1', 'cycle-2', { signal: expect.any(AbortSignal) });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps failed cycle requests distinct from empty results and retries', async () => {
    vi.mocked(getHoursCycleSummaryData).mockRejectedValue(new Error('Cycle offline'));
    renderWithQueryClient(<HoursCycleSummaryDashboardCard {...baseProps} />);
    await screen.findByText('Cycle hours unavailable');
    vi.mocked(getHoursCycleSummaryData).mockResolvedValue(cycleSummary);

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('9.00')).toBeInTheDocument();
  });
});
