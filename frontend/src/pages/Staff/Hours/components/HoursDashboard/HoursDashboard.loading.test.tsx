import { fireEvent, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { getHoursDashboardData } from '../../hours.api';
import { renderWithQueryClient } from '../../../../../tests/queryClientTestUtils';
import HoursDashboard from './HoursDashboard';

vi.mock('../../hours.api', () => ({ getHoursDashboardData: vi.fn() }));

const overview = (hours: number) => ({
  payPeriod: { periodStart: '2026-08-02', periodEnd: '2026-08-15', totalHours: hours, breakdown: [] },
  biweeklyAverage: { periodCount: 1, averageHours: hours, breakdown: [] },
});

it('keeps both hours shells while the selected staff request is pending', async () => {
  let resolveNext!: (data: ReturnType<typeof overview>) => void;
  vi.mocked(getHoursDashboardData)
    .mockResolvedValueOnce(overview(12))
    .mockReturnValueOnce(new Promise(resolve => { resolveNext = resolve; }));
  const staff = { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true } as const;
  const cycle = { id: 'cycle-1', name: 'Summer 2026', startsOn: '2026-07-01', endsOn: '2026-09-01', state: 'active' } as const;
  const props = { queryKey: ['hours'], staff, cycle };
  const { rerender } = renderWithQueryClient(<HoursDashboard {...props} />);
  await waitFor(() => expect(screen.getAllByText('12.00')).toHaveLength(2));
  const card = screen.getByRole('heading', { name: 'Hours This Pay Period' }).closest('article');
  fireEvent.click(screen.getAllByRole('button', { name: 'See Breakdown' })[0]);
  expect(screen.getByRole('dialog', { name: 'Zoe Wilson' })).toBeInTheDocument();

  rerender(<HoursDashboard {...props} staff={{ ...staff, id: 'staff-2', name: 'Jordan Lee' }} />);

  expect(screen.getByRole('heading', { name: 'Hours This Pay Period' }).closest('article')).toBe(card);
  expect(screen.getByRole('heading', { name: 'Average Biweekly Hours - Summer 2026' })).toBeInTheDocument();
  for (const label of ['Current Pay Period', 'Hours', 'Cycle', 'Biweekly Average']) {
    expect(screen.getByText(label)).toBeInTheDocument();
  }
  expect(screen.getAllByRole('status')).toHaveLength(4);
  expect(screen.getAllByRole('button', { name: 'See Breakdown' }).every(button => button.hasAttribute('disabled'))).toBe(true);
  expect(screen.queryByText('12.00')).not.toBeInTheDocument();
  expect(screen.queryByText('0.00')).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

  resolveNext(overview(6));
  await waitFor(() => expect(screen.getAllByText('6.00')).toHaveLength(2));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
