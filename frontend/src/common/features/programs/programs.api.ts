import { apiClient } from '../../../http/client';
import type { RequestOptions } from '../../../http/client';
import type { Program } from './types';

export function getPrograms({ assignedOnly = false }: { assignedOnly?: boolean } = {}, opts?: RequestOptions) {
  const path = `/programs${assignedOnly ? '?scope=assigned' : ''}`;
  return opts ? apiClient.get<Program[]>(path, opts) : apiClient.get<Program[]>(path);
}
