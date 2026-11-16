import { apiClient, type RequestOptions } from '../../../http/client';

export interface NamedReference {
  id: string;
  name: string;
}

export interface ProgramReference {
  id: string;
  title: string;
}
export type SchoolReference = NamedReference;

export interface CycleReference {
  id: string;
  title: string;
  startsOn: string;
  endsOn: string;
  state: 'upcoming' | 'active' | 'completed';
}

export type StaffReferenceFeature = 'tasks' | 'hours';

export interface StaffReference extends NamedReference {
  firstName: string;
  lastName: string;
  role: string;
  writable: boolean;
}

export function getCycleReferences(opts?: RequestOptions) {
  return apiClient.get<CycleReference[]>('/reference-data/cycles', opts);
}

export function getProgramReferences({ assignedOnly = false }: { assignedOnly?: boolean } = {}, opts?: RequestOptions) {
  const path = `/reference-data/programs${assignedOnly ? '?assignedOnly=true' : ''}`;
  return apiClient.get<ProgramReference[]>(path, opts);
}

export function getStaffReferences(feature: StaffReferenceFeature, opts?: RequestOptions) {
  return apiClient.get<StaffReference[]>(`/reference-data/staff?feature=${feature}`, opts);
}

export function getSchoolReferences(opts?: RequestOptions) {
  return apiClient.get<SchoolReference[]>('/reference-data/schools', opts);
}
