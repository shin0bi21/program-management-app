// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '../../../http/client';
import { getCohortYouthReportPdf } from './youthReport.api';

vi.mock('../../../http/client', () => ({ apiClient: { download: vi.fn() } }));

describe('youth report API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('downloads a cohort report filtered to one youth', () => {
    const options = { signal: new AbortController().signal };
    getCohortYouthReportPdf('cohort-1', { youthId: 'youth-1' }, options);

    expect(apiClient.download).toHaveBeenCalledWith(
      '/cohorts/cohort-1/reports/youth.pdf?youthId=youth-1',
      options,
    );
  });
});
