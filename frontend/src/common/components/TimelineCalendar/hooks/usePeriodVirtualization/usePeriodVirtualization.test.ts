// This suite owns virtual period normalization, range notifications, and date navigation.
import { act, renderHook } from '@testing-library/react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dayPeriodDefinition } from '../../utils/periods';
import { normalizePeriodVirtualizationOptions, usePeriodVirtualization } from './usePeriodVirtualization';

vi.mock('@tanstack/react-virtual', () => ({ useVirtualizer: vi.fn() }));

function virtualItem(index: number) {
  return { index, key: String(index), start: index * 100, end: (index + 1) * 100, size: 100, lane: 0 };
}

const scrollToOffset = vi.fn();

function mockWindow(indices: number[]) {
  vi.mocked(useVirtualizer).mockReturnValue({
    getVirtualItems: () => indices.map(virtualItem),
    getTotalSize: () => 500,
    scrollOffset: 200,
    scrollRect: { width: 300, height: 400 },
    scrollToOffset,
  } as never);
}

describe('usePeriodVirtualization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockWindow([1, 2, 3]);
  });

  it('normalizes invalid period and overscan inputs', () => {
    expect(normalizePeriodVirtualizationOptions(0, -4)).toEqual({ periodCount: 1, overscan: 0 });
    expect(normalizePeriodVirtualizationOptions(7.9, 2.8)).toEqual({ periodCount: 7, overscan: 2 });
  });

  it('announces the initial virtual range and newly built edges', () => {
    const onInitialPeriods = vi.fn();
    const onPeriodsBuilt = vi.fn();
    const options = {
      periodDefinition: dayPeriodDefinition,
      initialDate: new Date(2026, 7, 10),
      initialOffset: 0,
      periodCount: 5,
      overscan: 1,
      periodWidth: 100,
      coveredLeftWidth: 25,
      onInitialPeriods,
      onPeriodsBuilt,
    };
    const { rerender } = renderHook(() => usePeriodVirtualization(options));

    expect(onInitialPeriods).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ key: '2026-08-10' }),
    ]));

    mockWindow([0, 1, 2, 3, 4]);
    rerender();

    expect(onPeriodsBuilt).toHaveBeenCalledWith([
      expect.objectContaining({ key: '2026-08-08' }),
    ], 'left');
    expect(onPeriodsBuilt).toHaveBeenCalledWith([
      expect.objectContaining({ key: '2026-08-12' }),
    ], 'right');
  });

  it('scrolls to a requested date and resets data around that target', () => {
    const onPeriodsReset = vi.fn();
    const { result } = renderHook(() => usePeriodVirtualization({
      periodDefinition: dayPeriodDefinition,
      initialDate: new Date(2026, 7, 10),
      initialOffset: 0,
      periodCount: 5,
      overscan: 1,
      periodWidth: 100,
      coveredLeftWidth: 25,
      positionStorageKey: 'calendar:test-position',
      onPeriodsReset,
    }));

    act(() => result.current.goToDate(new Date(2026, 7, 11)));

    expect(scrollToOffset).toHaveBeenCalledWith(300, { align: 'start' });
    expect(onPeriodsReset).toHaveBeenCalledWith([
      expect.objectContaining({ key: '2026-08-10' }),
      expect.objectContaining({ key: '2026-08-11' }),
      expect.objectContaining({ key: '2026-08-12' }),
    ]);
  });
  it('uses inclusive selected dates, including leap day, and clamps restored positions and navigation', () => {
    mockWindow([0, 1, 2]);
    const { result } = renderHook(() => usePeriodVirtualization({
      periodDefinition: dayPeriodDefinition,
      initialDate: new Date(2035, 0, 1), initialOffset: 50,
      periodCount: 2500, dateRange: { start: '2028-02-28', end: '2028-03-01' },
      overscan: 1, periodWidth: 100, coveredLeftWidth: 25,
    }));
    expect(result.current.allPeriods.map(period => period.key)).toEqual(['2028-02-28', '2028-02-29', '2028-03-01']);
    expect(vi.mocked(useVirtualizer).mock.calls[vi.mocked(useVirtualizer).mock.calls.length - 1]?.[0]).toMatchObject({ count: 3, initialOffset: 200 });

    act(() => result.current.goToDate(new Date(2020, 0, 1)));
    expect(scrollToOffset).toHaveBeenLastCalledWith(0, { align: 'start' });
    act(() => result.current.goToDate(new Date(2040, 0, 1)));
    expect(scrollToOffset).toHaveBeenLastCalledWith(200, { align: 'start' });
  });

  it('covers a multi-year range while exposing only its virtual window', () => {
    mockWindow([0, 1, 2]);
    const { result } = renderHook(() => usePeriodVirtualization({
      periodDefinition: dayPeriodDefinition, initialDate: new Date(2026, 0, 1), initialOffset: 0,
      periodCount: 2500, dateRange: { start: '2026-01-01', end: '2028-12-31' },
      overscan: 1, periodWidth: 100, coveredLeftWidth: 25,
    }));
    expect(result.current.allPeriods).toHaveLength(1096);
    expect(result.current.allPeriods[result.current.allPeriods.length - 1]?.key).toBe('2028-12-31');
    expect(result.current.periods).toHaveLength(3);
  });

  it('rejects reversed dates before constructing periods', () => {
    expect(() => renderHook(() => usePeriodVirtualization({
      periodDefinition: dayPeriodDefinition, initialDate: new Date(2026, 0, 1), initialOffset: 0,
      periodCount: 2500, dateRange: { start: '2027-01-01', end: '2026-12-31' },
      overscan: 1, periodWidth: 100, coveredLeftWidth: 25,
    }))).toThrow('Calendar date range must contain valid ordered dates');
  });
});
