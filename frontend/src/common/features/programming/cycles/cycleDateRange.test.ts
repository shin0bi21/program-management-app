// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { getCycleDateRange } from './cycleDateRange';
import type { ProgramCycle } from './types';

const cycles: ProgramCycle[] = [
  { id: 'recent', title: 'Recent', startsOn: '2026-09-01', endsOn: '2026-12-31', state: 'active' },
  { id: 'old', title: 'Old', startsOn: '2024-01-01', endsOn: '2024-06-30', state: 'completed' },
  { id: 'next', title: 'Next', startsOn: '2027-01-01', endsOn: '2027-06-30', state: 'upcoming' },
];

describe('getCycleDateRange', () => {
  it('uses selected cycles in any order and keeps the full span across gaps and years', () => {
    expect(getCycleDateRange(cycles, ['next', 'old'])).toEqual({ start: '2024-01-01', end: '2027-06-30' });
    expect(getCycleDateRange(cycles, ['recent'])).toEqual({ start: '2026-09-01', end: '2026-12-31' });
  });

  it('uses all available cycles when the selection is empty', () => {
    expect(getCycleDateRange(cycles)).toEqual({ start: '2024-01-01', end: '2027-06-30' });
  });

  it('does not invent dates when no cycles match', () => {
    expect(getCycleDateRange([])).toBeUndefined();
    expect(getCycleDateRange(cycles, ['deleted'])).toBeUndefined();
  });
});
