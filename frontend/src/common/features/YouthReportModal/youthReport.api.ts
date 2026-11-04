import { apiClient } from '../../../http/client';
import type { RequestOptions } from '../../../http/client';

export function getProgramCycleYouthReportPdf(
  programCycle: { programId: string; cycleId: string },
  filters: { youthId?: string } = {},
  opts?: RequestOptions,
) {
  const query = new URLSearchParams();
  if (filters.youthId) query.set('youthId', filters.youthId);

  return apiClient.download(
    `/programs/${programCycle.programId}/cycles/${programCycle.cycleId}/reports/youth.pdf${query.size ? `?${query}` : ''}`,
    opts,
  );
}
