// Scope: verifies task dashboard composition and unmodified child-owner contracts.
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Task } from '../../../../../common/features/tasks/types';
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
  it('composes resource tasks and selected-task hours without transforming ownership', () => {
    const onLogHours = vi.fn();
    render(<TaskDashboard tasks={[task]} resourceName="Zoe Wilson" selectedTask={task} onLogHours={onLogHours} />);

    expect(screen.getByText('Task overview card')).toBeInTheDocument();
    expect(screen.getByText('Task hours card')).toBeInTheDocument();
    expect(overviewProps.current).toEqual({ tasks: [task], resourceName: 'Zoe Wilson' });
    expect(hoursProps.current).toEqual({ task, onLogHours });
  });
});
