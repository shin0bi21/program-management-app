// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import createPreferenceFilters from './createPreferenceFilters';

describe('createPreferenceFilters', () => {
  it('applies only a declared filter without replacing sibling preferences', () => {
    const updatePreferences = vi.fn();
    const filters = createPreferenceFilters({
      values: { programIds: ['program-1'], statuses: ['active'] },
      definitions: [{ id: 'programIds', label: 'Program', options: [] }],
      updatePreferences,
    });

    filters.apply('programIds', ['program-2']);
    filters.apply('statuses', []);
    filters.apply('unknown', []);

    expect(updatePreferences).toHaveBeenCalledExactlyOnceWith({ programIds: ['program-2'] });
    expect(filters.values.statuses).toEqual(['active']);
  });

  it('clears all selected fields in one update, including filters hidden by page policy', () => {
    const updatePreferences = vi.fn();
    const filters = createPreferenceFilters({
      values: { programIds: ['program-1'], statuses: ['active'] },
      definitions: [{ id: 'programIds', label: 'Program', options: [] }],
      updatePreferences,
    });

    filters.clear();

    expect(updatePreferences).toHaveBeenCalledExactlyOnceWith({ programIds: [], statuses: [] });
  });
});
