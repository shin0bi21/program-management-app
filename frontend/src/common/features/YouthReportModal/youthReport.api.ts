import { apiClient } from '../../../http/client';
import type { RequestOptions } from '../../../http/client';

export function getCohortYouthReportPdf(
  cohortId: string,
  filters: { youthId?: string } = {},
  opts?: RequestOptions,
) {
  const query = new URLSearchParams();
  if (filters.youthId) query.set('youthId', filters.youthId);

  return apiClient.download(
    `/cohorts/${cohortId}/reports/youth.pdf${query.size ? `?${query}` : ''}`,
    opts,
  );
}
