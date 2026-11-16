// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../../http/client';
import { getCycleReferences, getProgramReferences, getSchoolReferences, getStaffReferences } from './referenceData.api';

vi.mock('../../../http/client', () => ({ apiClient: { get: vi.fn() } }));

describe('reference data API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads shared cycle and school projections with cancellation', async () => {
    const options = { signal: new AbortController().signal };
    const cycles = [{ id: 'cycle-1', title: 'Fall', startsOn: '2026-09-01', endsOn: '2026-12-31', state: 'active' }];
    vi.mocked(apiClient.get).mockResolvedValueOnce(cycles).mockResolvedValueOnce([]);

    expect(await getCycleReferences(options)).toEqual(cycles);
    expect(await getSchoolReferences(options)).toEqual([]);
    expect(apiClient.get).toHaveBeenNthCalledWith(1, '/reference-data/cycles', options);
    expect(apiClient.get).toHaveBeenNthCalledWith(2, '/reference-data/schools', options);
  });

  it('serializes assigned program scope without changing the default scope', () => {
    const options = { signal: new AbortController().signal };
    getProgramReferences();
    getProgramReferences({ assignedOnly: false }, options);
    getProgramReferences({ assignedOnly: true }, options);

    expect(apiClient.get).toHaveBeenNthCalledWith(1, '/reference-data/programs', undefined);
    expect(apiClient.get).toHaveBeenNthCalledWith(2, '/reference-data/programs', options);
    expect(apiClient.get).toHaveBeenNthCalledWith(3, '/reference-data/programs?assignedOnly=true', options);
  });

  it.each(['tasks', 'hours'] as const)('sends the required %s staff capability scope', feature => {
    const options = { signal: new AbortController().signal };
    getStaffReferences(feature, options);

    expect(apiClient.get).toHaveBeenCalledWith(`/reference-data/staff?feature=${feature}`, options);
  });
});
