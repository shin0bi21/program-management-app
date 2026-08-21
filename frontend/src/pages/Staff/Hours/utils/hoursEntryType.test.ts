// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { makeHoursItem } from '../../../../tests/factories/hours';
import { getHoursEntryType, HOURS_ENTRY_TYPE_LABELS } from './hoursEntryType';

describe('hours entry types', () => {
  it.each([
    [{ taskId: 'task-1' }, 'task', 'Task'],
    [{ sessionId: 'session-1' }, 'session', 'Session'],
    [{ taskId: null, sessionId: null }, 'other', 'Regular'],
  ] as const)('classifies and labels an entry', (source, type, label) => {
    const item = makeHoursItem(source);
    expect(getHoursEntryType(item)).toBe(type);
    expect(HOURS_ENTRY_TYPE_LABELS[type]).toBe(label);
  });
});
