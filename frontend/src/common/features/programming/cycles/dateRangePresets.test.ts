// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { getDateRangePresets } from './dateRangePresets';
import type { ProgramCycle } from './types';

const cycle = (id: string, startsOn: string, endsOn: string): ProgramCycle => ({
  id, name: id, startsOn, endsOn, state: 'active',
});

describe('getDateRangePresets', () => {
  it('uses complete calendar months and years, including leap February and December', () => {
    expect(getDateRangePresets('2024-02-18', []).map(preset => preset.range)).toEqual([
      { start: '2024-02-01', end: '2024-02-29' },
      { start: '2024-01-01', end: '2024-12-31' },
    ]);
    expect(getDateRangePresets('2026-12-31', [])[0].range).toEqual({ start: '2026-12-01', end: '2026-12-31' });
  });

  it('offers the cycle containing today, including its first and last days', () => {
    const cycles = [
      cycle('ended', '2026-07-01', '2026-07-31'),
      cycle('current', '2026-08-01', '2026-08-31'),
      cycle('future', '2026-09-01', '2026-09-30'),
    ];
    for (const today of ['2026-08-01', '2026-08-31']) {
      expect(getDateRangePresets(today, cycles).find(preset => preset.id === 'current-cycle')).toEqual({
        id: 'current-cycle', label: 'Current Cycle', range: { start: '2026-08-01', end: '2026-08-31' },
      });
    }
  });

  it('does not guess a current cycle if existing dates overlap', () => {
    const cycles = [cycle('a', '2026-08-01', '2026-08-31'), cycle('b', '2026-08-15', '2026-09-01')];
    expect(getDateRangePresets('2026-08-20', cycles).some(preset => preset.id === 'current-cycle')).toBe(false);
  });

  it('preserves oversized cycle dates so the UI can show a disabled preset', () => {
    expect(getDateRangePresets('2026-08-15', [cycle('long', '2025-01-01', '2027-01-01')])
      .find(preset => preset.id === 'current-cycle')?.range).toEqual({ start: '2025-01-01', end: '2027-01-01' });
  });

  it('anchors 14-day payroll blocks to the latest started cycle and rolls over after day14', () => {
    const cycles = [cycle('older', '2026-08-01', '2026-08-31'), cycle('latest', '2026-09-02', '2026-09-03')];
    const payPeriod = (today: string) => getDateRangePresets(today, cycles).find(preset => preset.id === 'current-pay-period')?.range;
    expect(payPeriod('2026-09-15')).toEqual({ start: '2026-09-02', end: '2026-09-15' });
    expect(payPeriod('2026-09-16')).toEqual({ start: '2026-09-16', end: '2026-09-29' });
  });

  it('does not invent a pay period before any cycle has started', () => {
    expect(getDateRangePresets('2026-08-01', [cycle('future', '2026-09-01', '2026-10-01')])
      .map(preset => preset.id)).toEqual(['this-month', 'this-year']);
  });
});
