// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '../../../http/client';
import { getProgramCycleYouthReportPdf } from './youthReport.api';

vi.mock('../../../http/client', () => ({ apiClient: { download: vi.fn() } }));

describe('youth report API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('downloads a programCycle report filtered to one youth', () => {
    const options = { signal: new AbortController().signal };
    getProgramCycleYouthReportPdf({ programId: 'program-1', cycleId: 'cycle-1' }, { youthId: 'youth-1' }, options);

    expect(apiClient.download).toHaveBeenCalledWith(
      '/programs/program-1/cycles/cycle-1/reports/youth.pdf?youthId=youth-1',
      options,
    );
  });
});
