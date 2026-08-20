// Scope: verifies Hours dashboard state composition and overview-card inputs.
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import HoursDashboard from './HoursDashboard';

const overviewData = vi.hoisted(() => vi.fn());

vi.mock('./hooks/useHoursOverviewData', () => ({ default: overviewData }));

const staff = {
  id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true,
} as const;
const cycle = {
  id: 'cycle-1', name: 'Summer 2026', startsOn: '2026-07-01', endsOn: '2026-09-01', state: 'active',
} as const;
const baseProps = { queryKey: ['hours'] as const, staff, cycle };

describe('HoursDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    overviewData.mockReturnValue({ status: 'unavailable' });
  });

  it('loads data for the selected staff and cycle', () => {
    render(<HoursDashboard {...baseProps} />);

    expect(overviewData).toHaveBeenCalledWith(['hours'], 'staff-1', 'cycle-1');
  });

  it('renders unavailable composition without card titles until staff is selected', () => {
    render(<HoursDashboard {...baseProps} staff={null} cycle={null} />);

    expect(screen.getAllByText('Select a staff member to view their hours overview.')).toHaveLength(2);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('renders loading and error states through both dashboard cards', () => {
    overviewData.mockReturnValue({ status: 'loading' });
    const { rerender } = render(<HoursDashboard {...baseProps} />);
    expect(screen.getAllByText('Loading hours overview…')).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Hours This Pay Period' })).toBeInTheDocument();

    overviewData.mockReturnValue({ status: 'error', message: 'Overview offline' });
    rerender(<HoursDashboard {...baseProps} cycle={{ ...cycle, id: 'cycle-2' }} />);
    expect(screen.getAllByText('Overview offline')).toHaveLength(2);
  });

  it('maps a ready overview into pay-period and cycle cards', () => {
    overviewData.mockReturnValue({
      status: 'ready',
      data: {
        payPeriod: {
          periodStart: '2026-08-02', periodEnd: '2026-08-15', totalHours: 12,
          breakdown: [{ label: 'Meeting', hours: 5 }, { label: 'Outreach', hours: 7 }],
        },
        biweeklyAverage: {
          periodCount: 2, averageHours: 9,
          breakdown: [{ label: 'Meeting', hours: 4 }, { label: 'Outreach', hours: 5 }],
        },
      },
    });
    render(<HoursDashboard {...baseProps} />);

    expect(screen.getByRole('heading', { name: 'Hours This Pay Period' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Average Biweekly Hours - Summer 2026' })).toBeInTheDocument();
    expect(screen.getByText('12.00')).toBeInTheDocument();
    expect(screen.getByText('9.00')).toBeInTheDocument();
  });
});
