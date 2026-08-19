import { apiClient } from '../../../http/client';
import type { RequestOptions } from '../../../http/client';
import type { CreateProgramInput, Program, UpdateProgramInput } from './types';

export function getPrograms({ assignedOnly = false }: { assignedOnly?: boolean } = {}, opts?: RequestOptions) {
  const path = `/programs${assignedOnly ? '?scope=assigned' : ''}`;
  return opts ? apiClient.get<Program[]>(path, opts) : apiClient.get<Program[]>(path);
}

export function createProgram(data: CreateProgramInput | string) {
  return apiClient.post<Program>('/programs', typeof data === 'string' ? { name: data } : data);
}

export function updateProgram(programId: string, data: UpdateProgramInput) {
  return apiClient.put<Program>(`/programs/${programId}`, data);
}
