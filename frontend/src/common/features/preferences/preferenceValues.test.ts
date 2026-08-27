// Scope: verifies persisted sorting is accepted only for current page sort keys.
// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  haveSamePreferenceValues,
  mergePreferenceDefaults,
  resolveAvailablePreferenceIds,
  resolveAvailablePreferenceValues,
  resolvePreferenceSorting,
  resolvePreferenceNumberRecord,
  resolvePreferenceString,
  resolvePreferenceStringArray,
  resolvePreferenceValue,
} from './preferenceValues';

const fallback = { key: 'name', direction: 'asc' } as const;

describe('resolvePreferenceSorting', () => {
  it('accepts supported sorting and replaces obsolete or malformed values', () => {
    expect(resolvePreferenceSorting(
      { key: 'email', direction: 'desc' },
      ['name', 'email'],
      fallback,
    )).toEqual({ key: 'email', direction: 'desc' });

    expect(resolvePreferenceSorting(
      { key: 'removedColumn', direction: 'asc' },
      ['name', 'email'],
      fallback,
    )).toBe(fallback);

    expect(resolvePreferenceSorting(
      { key: 'name', direction: 'sideways' },
      ['name', 'email'],
      fallback,
    )).toBe(fallback);
  });
});

describe('preference normalization primitives', () => {
  it('merges current values with defaults and validates scalar values', () => {
    expect(mergePreferenceDefaults(
      { view: 'calendar', search: '' },
      { view: 'table' },
    )).toEqual({ view: 'table', search: '' });
    expect(resolvePreferenceValue('table', ['calendar', 'table'], 'calendar')).toBe('table');
    expect(resolvePreferenceValue('removed', ['calendar', 'table'], 'calendar')).toBe('calendar');
    expect(resolvePreferenceString('  workshop  ')).toBe('workshop');
    expect(resolvePreferenceStringArray(['staff-1', null, 3])).toEqual(['staff-1']);
    expect(resolvePreferenceNumberRecord({ name: 240, invalid: 'wide', zero: 0 })).toEqual({ name: 240 });
    expect(resolvePreferenceNumberRecord(['not', 'a', 'record'])).toEqual({});
  });

  it('preserves unverified selections and filters them once options are available', () => {
    const ids = ['staff-1', 'removed-staff'];
    const values = ['active', 'removed-status'];

    expect(resolveAvailablePreferenceIds(ids, undefined, false)).toEqual(ids);
    expect(resolveAvailablePreferenceIds(ids, [{ id: 'staff-1' }], true)).toEqual(['staff-1']);
    expect(resolveAvailablePreferenceValues(values, undefined, false)).toEqual(values);
    expect(resolveAvailablePreferenceValues(values, [{ value: 'active' }], true)).toEqual(['active']);
  });

  it('compares ordered preference values', () => {
    expect(haveSamePreferenceValues(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(haveSamePreferenceValues(['a', 'b'], ['b', 'a'])).toBe(false);
  });
});
