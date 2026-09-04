import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { makeHoursItem } from '../../../../../tests/factories/hours';
import HoursTypeLabel from './HoursTypeLabel';

describe('HoursTypeLabel', () => {
  it.each([
    ['Task', 'task', { taskId: 'task-1' }],
    ['Session', 'session', { taskId: null, sessionId: 'session-1' }],
    ['Regular', 'regular', { taskId: null, sessionId: null }],
  ] as const)('renders %s entries', (label, className, source) => {
    render(<HoursTypeLabel item={makeHoursItem(source)} />);
    expect(screen.getByText(label)).toHaveClass('hours-item__type', className);
  });
});
