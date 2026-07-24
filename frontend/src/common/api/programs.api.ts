import { apiClient } from './http/client';
import type { CreateProgramInput, Program } from '../types/program';

export function getPrograms() {
  return apiClient.get<Program[]>('/programs');
}

export function createProgram(data: CreateProgramInput | string) {
  return apiClient.post<Program>('/programs', typeof data === 'string' ? { name: data } : data);
}
