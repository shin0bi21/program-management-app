// Scope: verifies persisted sorting is accepted only for current page sort keys.
// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { resolvePreferenceSorting } from './preferenceValues';

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
