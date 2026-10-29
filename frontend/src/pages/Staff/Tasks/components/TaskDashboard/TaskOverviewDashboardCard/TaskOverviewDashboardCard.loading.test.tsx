import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getTaskDashboardData } from '../../../tasks.api';
import { makeTask } from '../../../../../../tests/factories/task';
import { renderWithQueryClient } from '../../../../../../tests/queryClientTestUtils';
import TaskOverviewDashboardCard from './TaskOverviewDashboardCard';

vi.mock('../../../tasks.api', () => ({ getTaskDashboardData: vi.fn() }));

describe('TaskOverviewDashboardCard resource loading', () => {
  it('keeps its shell and disables the old report until the new resource responds', async () => {
    let resolveNext!: (tasks: ReturnType<typeof makeTask>[]) => void;
    vi.mocked(getTaskDashboardData)
      .mockResolvedValueOnce([makeTask({ id: 'old-task', title: 'Old resource task' })])
      .mockReturnValueOnce(new Promise(resolve => { resolveNext = resolve; }));
    const props = { queryKey: ['tasks'], resourceId: 'staff-1', resourceName: 'First Staff', today: '2026-08-11' };
    const { rerender } = renderWithQueryClient(<TaskOverviewDashboardCard {...props} />);
    await waitFor(() => expect(screen.getByText('Assigned').nextSibling).toHaveTextContent('1'));
    const card = screen.getByRole('heading', { name: 'Task Overview' }).closest('article');
    fireEvent.click(screen.getByRole('button', { name: 'See Breakdown' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Old resource task');

    rerender(<TaskOverviewDashboardCard {...props} resourceId="staff-2" resourceName="Second Staff" />);

    expect(screen.getByRole('heading', { name: 'Task Overview' }).closest('article')).toBe(card);
    expect(screen.getAllByRole('status')).toHaveLength(4);
    expect(screen.getByRole('button', { name: 'See Breakdown' })).toBeDisabled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Old resource task')).not.toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();

    resolveNext([]);
    await waitFor(() => expect(screen.getByRole('button', { name: 'See Breakdown' })).toBeEnabled());
    expect(screen.getByText('Assigned').nextSibling).toHaveTextContent('0');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
