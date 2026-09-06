// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  normalizePreferences,
  preferenceOption,
  optionalPreferenceOption,
  preferenceOptions,
  preferenceIds,
  optionalPreferenceId,
  preferenceText,
  preferenceSorting,
  preferenceColumnWidths,
  preferenceHiddenColumns,
} from './preferences';

const fields = {
  view: preferenceOption(['calendar', 'table'], 'calendar'),
  search: preferenceText(),
  statuses: preferenceOptions(['active', 'inactive'], ['active']),
  programIds: preferenceIds(['program-1']),
  sorting: preferenceSorting(['name', 'email'], { key: 'name', direction: 'asc' }),
  columnWidths: preferenceColumnWidths(['name', 'email']),
  hiddenColumns: preferenceHiddenColumns(['name', 'email']),
};

describe('preference rules', () => {
  it('repairs malformed fields independently and preserves valid siblings', () => {
    expect(normalizePreferences(fields, {
      view: 'removed', search: '  workshop  ', statuses: ['inactive', 'removed', 3],
      programIds: ['program-1', 'removed'], sorting: { key: 'removed', direction: 'desc' },
      columnWidths: { name: 180, email: -1, removed: 200 }, hiddenColumns: 'name',
    })).toEqual({
      view: 'calendar', search: 'workshop', statuses: ['inactive'], programIds: ['program-1'],
      sorting: { key: 'name', direction: 'asc' }, columnWidths: { name: 180 }, hiddenColumns: [],
    });
  });

  it.each([null, [], 'broken', 42])('uses defaults for a malformed or missing record: %j', stored => {
    expect(normalizePreferences(fields, stored)).toMatchObject({ view: 'calendar', statuses: ['active'], search: '' });
  });

  it('preserves an intentional empty selection and null selection', () => {
    expect(preferenceOptions(['active'], ['active'])([])).toEqual([]);
    expect(optionalPreferenceId(['cycle-1'], 'cycle-1')(null)).toBeNull();
    expect(optionalPreferenceOption(['active'], 'active')(null)).toBeNull();
  });

  it('preserves unverified IDs but removes confirmed unavailable options', () => {
    const saved = ['program-1', 'removed', null];
    expect(preferenceIds(undefined)(saved)).toEqual(['program-1', 'removed']);
    expect(preferenceIds(['program-1'])(saved)).toEqual(['program-1']);
    expect(preferenceIds([])(saved)).toEqual([]);
    expect(optionalPreferenceId(undefined)('removed')).toBe('removed');
    expect(optionalPreferenceId(['cycle-1'], 'cycle-1')('removed')).toBeNull();
  });

  it('validates finite values even when dynamic options are unavailable', () => {
    const saved = ['active', 'inactive', 'removed'];
    expect(preferenceOptions(['active', 'inactive'], [], null)(saved)).toEqual(['active', 'inactive']);
    expect(preferenceOptions(['active', 'inactive'], [], ['active'])(saved)).toEqual(['active']);
  });

  it('checks sort direction and finite positive widths', () => {
    expect(preferenceSorting(['name'], { key: 'name', direction: 'asc' })({ key: 'name', direction: 'sideways' }))
      .toEqual({ key: 'name', direction: 'asc' });
    expect(preferenceColumnWidths(['name', 'email'])({ name: Infinity, email: 'wide' })).toEqual({});
  });

  it('reuses already normalized records without depending on property order', () => {
    const stored = normalizePreferences(fields, null);
    expect(normalizePreferences(fields, stored)).toBe(stored);
    const reordered = { view: 'table', search: 'hello' };
    expect(normalizePreferences({ search: fields.search, view: fields.view }, reordered)).toBe(reordered);
  });
});
