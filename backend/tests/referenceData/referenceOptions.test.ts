import { getMatchingReferenceIds } from '../../src/services/shared/referenceOptions';

describe('reference options', () => {
  it('matches display names or IDs case-insensitively and returns only IDs', () => {
    const options = [{ id: 'planning_prep', name: 'Planning / Prep' }, { id: 'meeting', name: 'Meeting' }];

    expect(getMatchingReferenceIds(options, '/ PREP')).toEqual(['planning_prep']);
    expect(getMatchingReferenceIds(options, 'PLANNING_PREP')).toEqual(['planning_prep']);
    expect(getMatchingReferenceIds(options, 'missing')).toEqual([]);
    expect(getMatchingReferenceIds(options, '')).toEqual([]);
    expect(getMatchingReferenceIds(options)).toEqual([]);
  });
});
