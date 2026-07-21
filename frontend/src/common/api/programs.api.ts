import { apiClient } from './http/client';
import type { Program } from '../types/program';

export function getPrograms() {
  return apiClient.get<Program[]>('/programs');
}

export function createProgram(name: string) {
  return apiClient.post<Program>('/programs', { name });
}
