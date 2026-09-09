import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Task } from '../../types';
import TaskDashboard from './TaskDashboard';

const overviewProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
const hoursProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));

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
  it('passes selection and callbacks to the overview and hours cards', () => {
    const onLogHours = vi.fn();
    const onErrorChange = vi.fn();
    render(<TaskDashboard
      queryKey={['tasks']}
      resourceId="staff-1"
      resourceName="Zoe Wilson"
      today="2026-08-11"
      selectedTask={task}
      onLogHours={onLogHours}
      onErrorChange={onErrorChange}
    />);

    expect(screen.getByText('Task overview card')).toBeInTheDocument();
    expect(screen.getByText('Task hours card')).toBeInTheDocument();
    expect(overviewProps.current).toEqual({
      queryKey: ['tasks'], resourceId: 'staff-1', resourceName: 'Zoe Wilson', today: '2026-08-11', onErrorChange,
    });
    expect(hoursProps.current).toEqual({ task, onLogHours });
  });
});
