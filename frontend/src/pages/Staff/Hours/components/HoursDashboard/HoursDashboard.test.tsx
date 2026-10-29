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

  it('retains titles and metric labels before staff is selected', () => {
    render(<HoursDashboard {...baseProps} staff={null} cycle={null} />);

    expect(screen.getAllByText('Select a staff member to view their hours overview.')).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Hours This Pay Period' })).toBeInTheDocument();
    expect(screen.getByText('Current Pay Period')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'See Breakdown' }).every(button => button.hasAttribute('disabled'))).toBe(true);
  });

  it('renders loading and error states through both dashboard cards', () => {
    const onErrorChange = vi.fn();
    overviewData.mockReturnValue({ status: 'loading' });
    const { rerender } = render(<HoursDashboard {...baseProps} onErrorChange={onErrorChange} />);
    expect(screen.getAllByRole('status')).toHaveLength(4);
    expect(screen.getByText('Current Pay Period')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'See Breakdown' }).every(button => button.hasAttribute('disabled'))).toBe(true);
    expect(screen.getByRole('heading', { name: 'Hours This Pay Period' })).toBeInTheDocument();

    const card = screen.getByRole('heading', { name: 'Hours This Pay Period' }).closest('article');
    const retry = vi.fn();
    overviewData.mockReturnValue({ status: 'error', message: 'Overview offline', retry });
    rerender(<HoursDashboard {...baseProps} cycle={{ ...cycle, id: 'cycle-2' }} onErrorChange={onErrorChange} />);
    expect(screen.getAllByText('Hours overview unavailable')).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Hours This Pay Period' }).closest('article')).toBe(card);
    expect(screen.getByText('Current Pay Period')).toBeInTheDocument();
    expect(screen.getByText('Biweekly Average')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'See Breakdown' }).every(button => button.hasAttribute('disabled'))).toBe(true);
    expect(onErrorChange).toHaveBeenLastCalledWith({
      message: 'Overview offline',
      action: { label: 'Retry', onClick: retry },
    });
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
  it('keeps the same labeled card shells while a new staff overview is pending', () => {
    overviewData.mockReturnValue({ status: 'ready', data: {
      payPeriod: { periodStart: '2026-08-02', periodEnd: '2026-08-15', totalHours: 12, breakdown: [] },
      biweeklyAverage: { periodCount: 1, averageHours: 9, breakdown: [] },
    } });
    const { rerender } = render(<HoursDashboard {...baseProps} />);
    const card = screen.getByRole('heading', { name: 'Hours This Pay Period' }).closest('article');

    overviewData.mockReturnValue({ status: 'loading' });
    rerender(<HoursDashboard {...baseProps} staff={{ ...staff, id: 'staff-2', name: 'Jordan Lee' }} />);

    expect(screen.getByRole('heading', { name: 'Hours This Pay Period' }).closest('article')).toBe(card);
    for (const label of ['Current Pay Period', 'Hours', 'Cycle', 'Biweekly Average']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.queryByText('12.00')).not.toBeInTheDocument();
    expect(screen.queryByText('9.00')).not.toBeInTheDocument();
    expect(screen.queryByText('0.00')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'See Breakdown' }).every(button => button.hasAttribute('disabled'))).toBe(true);
  });

});
