// Scope: verifies dashboard query wiring, card composition, selected-task hours, and errors.
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Task } from '../../types';
import TaskDashboard from './TaskDashboard';

const overviewProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
const hoursProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
const overviewHook = vi.hoisted(() => ({
  tasks: [] as Task[],
  loading: false,
  error: null as string | null,
  queryKey: null as readonly unknown[] | null,
  resourceId: null as string | null,
}));

vi.mock('./hooks/useTaskOverviewData', () => ({
  default: (queryKey: readonly unknown[], resourceId: string) => {
    overviewHook.queryKey = queryKey;
    overviewHook.resourceId = resourceId;
    return { tasks: overviewHook.tasks, loading: overviewHook.loading, error: overviewHook.error };
  },
}));
vi.mock('./TaskOverviewDashboardCard/TaskOverviewDashboardCard', () => ({
  default: (props: Record<string, unknown>) => {
    overviewProps.current = props;
    return <div>Task overview card</div>;
  },
}));
vi.mock('./TaskHoursLoggedDashboardCard/TaskHoursLoggedDashboardCard', () => ({
  default: (props: Record<string, unknown>) => {
    hoursProps.current = props;
    return <div>Task hours card</div>;
  },
}));

const task = { id: 'task-1', title: 'Prepare workshop' } as Task;

describe('TaskDashboard', () => {
  beforeEach(() => {
    overviewHook.tasks = [task];
    overviewHook.loading = false;
    overviewHook.error = null;
    overviewHook.queryKey = null;
    overviewHook.resourceId = null;
  });

  it('loads the resource overview and composes selected-task hours', () => {
    const onLogHours = vi.fn();
    render(<TaskDashboard
      queryKey={['tasks']}
      resourceId="staff-1"
      resourceName="Zoe Wilson"
      today="2026-08-11"
      selectedTask={task}
      onLogHours={onLogHours}
    />);

    expect(screen.getByText('Task overview card')).toBeInTheDocument();
    expect(screen.getByText('Task hours card')).toBeInTheDocument();
    expect(overviewHook.queryKey).toEqual(['tasks']);
    expect(overviewHook.resourceId).toBe('staff-1');
    expect(overviewProps.current).toEqual({ tasks: [task], resourceName: 'Zoe Wilson', today: '2026-08-11' });
    expect(hoursProps.current).toEqual({ task, onLogHours });
  });

  it('renders the overview-owned error without hiding the selected-task card', () => {
    overviewHook.error = 'Unable to load task overview.';
    overviewHook.tasks = [];

    render(<TaskDashboard
      queryKey={['tasks']}
      resourceId="staff-1"
      resourceName="Zoe Wilson"
      today="2026-08-11"
      selectedTask={task}
    />);

    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load task overview.');
    expect(screen.getByText('Task hours card')).toBeInTheDocument();
  });

  it('replaces the overview card with a loading state during a resource transition', () => {
    overviewHook.loading = true;

    render(<TaskDashboard
      queryKey={['tasks']}
      resourceId="staff-2"
      resourceName="Alex Smith"
      today="2026-08-11"
      selectedTask={null}
    />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading task overview…');
    expect(screen.queryByText('Task overview card')).not.toBeInTheDocument();
    expect(screen.getByText('Task hours card')).toBeInTheDocument();
  });
});
