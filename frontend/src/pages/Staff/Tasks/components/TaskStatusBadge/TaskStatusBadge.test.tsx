// Scope: verifies date-derived open-task labels and terminal lifecycle labels.
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Task } from '../../../../../common/features/tasks/types';
import { makeTask } from '../../../../../tests/factories/task';
import TaskStatusBadge from './TaskStatusBadge';

describe('TaskStatusBadge', () => {
  afterEach(() => vi.useRealTimers());

  it.each([
    [{ startDate: '2026-08-12', dueDate: '2026-08-13' }, 'upcoming', 'Upcoming'],
    [{ startDate: '2026-08-10', dueDate: '2026-08-12' }, 'active', 'Active'],
    [{ startDate: '2026-08-08', dueDate: '2026-08-10' }, 'overdue', 'Overdue'],
    [{ status: 'completed' }, 'completed', 'Completed'],
    [{ status: 'cancelled' }, 'cancelled', 'Cancelled'],
  ] satisfies Array<[Partial<Task>, string, string]>)('renders %s as %s', (overrides, modifier, label) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-11T12:00:00'));
    render(<TaskStatusBadge task={makeTask(overrides)} today="2026-08-11" />);

    expect(screen.getByText(label)).toHaveClass(`task-status-badge--${modifier}`);
  });
});
