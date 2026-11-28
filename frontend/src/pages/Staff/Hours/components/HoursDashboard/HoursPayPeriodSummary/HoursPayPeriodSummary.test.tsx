import { fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getHoursPayPeriodData, type HoursPayPeriodData } from '../../../api/hours.api';
import { renderWithQueryClient } from '../../../../../../tests/queryClientTestUtils';
import HoursPayPeriodSummary from './HoursPayPeriodSummary';

vi.mock('../../../api/hours.api', () => ({ getHoursPayPeriodData: vi.fn() }));

const staff = {
  id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true,
};
const baseProps = { queryKey: ['hours'], staff };
const payPeriod = {
  periodStart: '2026-08-02', periodEnd: '2026-08-15', totalHours: 12,
  breakdown: [{ label: 'Meeting', hours: 12 }],
};

describe('HoursPayPeriodSummary', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getHoursPayPeriodData).mockResolvedValue(payPeriod);
  });

  it('waits for shared staff selection and requests the current pay period', async () => {
    const { rerender } = renderWithQueryClient(<HoursPayPeriodSummary
      {...baseProps}
      staff={null}
    />);
    expect(getHoursPayPeriodData).not.toHaveBeenCalled();

    rerender(<HoursPayPeriodSummary {...baseProps} />);

    expect(await screen.findByText('12.00')).toBeInTheDocument();
    expect(getHoursPayPeriodData).toHaveBeenCalledWith('staff-1', null, { signal: expect.any(AbortSignal) });
  });

  it('replaces stale totals and closes the staff breakdown when staff changes', async () => {
    let resolveNext!: (data: HoursPayPeriodData) => void;
    vi.mocked(getHoursPayPeriodData)
      .mockResolvedValueOnce(payPeriod)
      .mockReturnValueOnce(new Promise(resolve => { resolveNext = resolve; }));
    const { rerender } = renderWithQueryClient(<HoursPayPeriodSummary {...baseProps} />);
    await screen.findByText('12.00');
    fireEvent.click(screen.getByRole('button', { name: 'See Breakdown' }));
    const breakdown = screen.getByRole('dialog', { name: 'Zoe Wilson' });
    expect(within(breakdown).getByText('Meeting')).toBeInTheDocument();
    expect(within(breakdown).getByRole('img', { name: 'Breakdown of 12.00 hours' })).toBeInTheDocument();

    rerender(<HoursPayPeriodSummary
      {...baseProps}
      staff={{ ...staff, id: 'staff-2', name: 'Jordan Lee' }}
    />);

    expect(screen.queryByText('12.00')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'See Breakdown' })).toBeDisabled();
    expect(getHoursPayPeriodData).toHaveBeenLastCalledWith('staff-2', null, { signal: expect.any(AbortSignal) });

    resolveNext({ ...payPeriod, totalHours: 6 });
    expect(await screen.findByText('6.00')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
