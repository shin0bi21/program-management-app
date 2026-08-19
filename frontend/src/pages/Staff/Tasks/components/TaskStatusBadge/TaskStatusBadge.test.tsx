// Scope: verifies every task status label and its owned visual modifier.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { TaskStatus } from '../../../../../common/features/tasks/types';
import TaskStatusBadge from './TaskStatusBadge';

describe('TaskStatusBadge', () => {
  it.each([
    ['todo', 'To do'],
    ['in_progress', 'In progress'],
    ['completed', 'Completed'],
    ['cancelled', 'Cancelled'],
  ] satisfies Array<[TaskStatus, string]>)('renders %s', (status, label) => {
    render(<TaskStatusBadge status={status} />);

    expect(screen.getByText(label)).toHaveClass(`task-status-badge--${status}`);
  });
});
