import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getHoursCycleSummaryData, getHoursPayPeriodData, type HoursPayPeriodData } from '../../hours.api';
import { renderWithQueryClient } from '../../../../../tests/queryClientTestUtils';
import HoursDashboard from './HoursDashboard';

vi.mock('../../hours.api', () => ({
  getHoursPayPeriodData: vi.fn(),
  getHoursCycleSummaryData: vi.fn(),
}));

const staff = {
  id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true,
} as const;
const cycle = {
  id: 'cycle-1', name: 'Summer 2026', startsOn: '2026-07-01', endsOn: '2026-09-01', state: 'active',
} as const;
const baseProps = { queryKey: ['hours'] as const, staff, cycle };
const payPeriod = {
  periodStart: '2026-08-02', periodEnd: '2026-08-15', totalHours: 12,
  breakdown: [{ label: 'Meeting', hours: 12 }],
};
const cycleSummary = { periodCount: 2, averageHours: 9, breakdown: [{ label: 'Meeting', hours: 9 }] };

describe('HoursDashboard', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getHoursPayPeriodData).mockResolvedValue(payPeriod);
    vi.mocked(getHoursCycleSummaryData).mockResolvedValue(cycleSummary);
  });

  it('waits for staff selection and loads the pay period without a cycle', async () => {
    const { rerender } = renderWithQueryClient(<HoursDashboard {...baseProps} staff={null} cycle={null} />);
    expect(getHoursPayPeriodData).not.toHaveBeenCalled();
    expect(getHoursCycleSummaryData).not.toHaveBeenCalled();
    expect(screen.getAllByRole('button', { name: 'See Breakdown' }).every(button => button.hasAttribute('disabled'))).toBe(true);

    rerender(<HoursDashboard {...baseProps} cycle={null} />);

    expect(await screen.findByText('12.00')).toBeInTheDocument();
    expect(getHoursPayPeriodData).toHaveBeenCalledWith('staff-1', null, { signal: expect.any(AbortSignal) });
    expect(getHoursCycleSummaryData).not.toHaveBeenCalled();
  });

  it('changes cycle data without refetching the independent pay period', async () => {
    const { rerender } = renderWithQueryClient(<HoursDashboard {...baseProps} />);
    expect(await screen.findByText('12.00')).toBeInTheDocument();
    expect(await screen.findByText('9.00')).toBeInTheDocument();
    vi.mocked(getHoursCycleSummaryData).mockResolvedValue({ ...cycleSummary, averageHours: 6 });

    rerender(<HoursDashboard {...baseProps} cycle={{ ...cycle, id: 'cycle-2', name: 'Fall 2026' }} />);

    expect(await screen.findByText('6.00')).toBeInTheDocument();
    expect(screen.getByText('12.00')).toBeInTheDocument();
    expect(getHoursPayPeriodData).toHaveBeenCalledTimes(1);
    expect(getHoursCycleSummaryData).toHaveBeenLastCalledWith('staff-1', 'cycle-2', { signal: expect.any(AbortSignal) });
  });

  it('keeps pay-period data available when the cycle request fails and retries only that query', async () => {
    const onMessageChange = vi.fn();
    vi.mocked(getHoursCycleSummaryData).mockRejectedValue(new Error('Cycle offline'));
    renderWithQueryClient(<HoursDashboard {...baseProps} onMessageChange={onMessageChange} />);

    expect(await screen.findByText('12.00')).toBeInTheDocument();
    expect(await screen.findByText('Cycle hours unavailable')).toBeInTheDocument();
    await waitFor(() => expect(onMessageChange).toHaveBeenLastCalledWith([
      { message: 'Cycle offline', action: { label: 'Retry', onClick: expect.any(Function) } },
    ]));
    vi.mocked(getHoursCycleSummaryData).mockResolvedValue(cycleSummary);

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('9.00')).toBeInTheDocument();
    expect(getHoursPayPeriodData).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onMessageChange).toHaveBeenLastCalledWith(null));
  });

  it('clears the previous staff numbers and open breakdown while new staff hours load', async () => {
    let resolveNext!: (data: HoursPayPeriodData) => void;
    vi.mocked(getHoursPayPeriodData)
      .mockResolvedValueOnce(payPeriod)
      .mockReturnValueOnce(new Promise(resolve => { resolveNext = resolve; }));
    vi.mocked(getHoursCycleSummaryData).mockResolvedValueOnce(cycleSummary)
      .mockReturnValueOnce(new Promise(() => {}));
    const { rerender } = renderWithQueryClient(<HoursDashboard {...baseProps} />);
    await screen.findByText('12.00');
    fireEvent.click(screen.getAllByRole('button', { name: 'See Breakdown' })[0]);
    expect(screen.getByRole('dialog', { name: 'Zoe Wilson' })).toBeInTheDocument();

    rerender(<HoursDashboard {...baseProps} staff={{ ...staff, id: 'staff-2', name: 'Jordan Lee' }} />);

    expect(screen.queryByText('12.00')).not.toBeInTheDocument();
    expect(screen.queryByText('9.00')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'See Breakdown' }).every(button => button.hasAttribute('disabled'))).toBe(true);

    resolveNext({ ...payPeriod, totalHours: 6 });
    expect(await screen.findByText('6.00')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
