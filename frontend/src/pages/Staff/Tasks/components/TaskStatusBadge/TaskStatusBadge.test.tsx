// Scope: verifies backend-derived task status labels and modifiers.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Task } from '../../types';
import { makeTask } from '../../../../../tests/factories/task';
import TaskStatusBadge from './TaskStatusBadge';

describe('TaskStatusBadge', () => {
  it.each([
    [{ status: 'upcoming', statusLabel: 'Upcoming' }, 'upcoming', 'Upcoming'],
    [{ status: 'active', statusLabel: 'Active' }, 'active', 'Active'],
    [{ status: 'overdue', statusLabel: 'Overdue' }, 'overdue', 'Overdue'],
    [{ state: 'completed', status: 'completed', statusLabel: 'Completed' }, 'completed', 'Completed'],
    [{ state: 'cancelled', status: 'cancelled', statusLabel: 'Cancelled' }, 'cancelled', 'Cancelled'],
  ] satisfies Array<[Partial<Task>, string, string]>)('renders %s as %s', (overrides, modifier, label) => {
    render(<TaskStatusBadge task={makeTask(overrides)} />);

    expect(screen.getByText(label)).toHaveClass(`task-status-badge--${modifier}`);
  });
});
