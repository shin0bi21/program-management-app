import type { ProgramCycleAssignment } from '../Programming/Programs/types';
import { apiClient } from '../../http/client';
import type { RequestOptions } from '../../http/client';
import { TABLE_PAGE_SIZE, type CursorPage, type CursorRequest } from '../../query/types';
import type {
  DiscoverySource,
  Lead,
  LeadFilters,
  LeadNote,
  LeadSortKey,
  EditableLeadStatus,
  LeadRelationship,
} from './types';

interface CreateLeadInput {
  youthFirstName: string;
  youthLastName: string;
  dateOfBirth: string;
  school: string;
  contactPhoneNumber: string;
  contactRelationship: LeadRelationship;
  discoverySource: DiscoverySource;
  notes?: string;
}

type UpdateLeadInput = CreateLeadInput;

export const getLeads = (
  filters: LeadFilters = {},
  pagination?: CursorRequest<LeadSortKey>,
  opts?: RequestOptions,
) => {
  const params = new URLSearchParams();
  if (filters.search?.trim()) params.set('search', filters.search.trim());
  if (filters.statuses?.length) params.set('statuses', filters.statuses.join(','));
  if (filters.programIds?.length) params.set('programIds', filters.programIds.join(','));
  if (filters.origins?.length) params.set('origins', filters.origins.join(','));
  if (filters.submitterRoles?.length) params.set('submitterRoles', filters.submitterRoles.join(','));
  if (pagination) {
    params.set('sort', pagination.key);
    params.set('direction', pagination.direction);
    params.set('limit', String(pagination.limit ?? TABLE_PAGE_SIZE));
    if (pagination.cursor) params.set('cursor', pagination.cursor);
  }
  const query = params.toString();
  const path = `/leads${query ? `?${query}` : ''}`;
  return opts
    ? apiClient.get<CursorPage<Lead>>(path, opts)
    : apiClient.get<CursorPage<Lead>>(path);
};
export const createLead = (data: CreateLeadInput) => apiClient.post<Lead>('/leads', data);
export const updateLead = (id: string, data: UpdateLeadInput) => apiClient.put<Lead>(`/leads/${id}`, data);
export const updateLeadStatus = (id: string, status: EditableLeadStatus) =>
  apiClient.patch<Lead>(`/leads/${id}/status`, { status });
export const deleteLead = (id: string) => apiClient.delete<{ id: string }>(`/leads/${id}`);
export interface LeadSignUpResult { lead: Lead; updatedProgramCycle?: ProgramCycleAssignment }

export const signUpLead = (
  id: string,
  programCycle: { programId: string; cycleId: string } | null,
  noteCategory?: 'general' | 'health' | 'preference',
  dateOfBirth?: string,
) =>
  apiClient.post<LeadSignUpResult>(`/leads/${id}/sign-up`, {
    programId: programCycle?.programId ?? null,
    cycleId: programCycle?.cycleId ?? null,
    ...(noteCategory && { noteCategory }),
    ...(dateOfBirth && { dateOfBirth }),
  });

export const getLeadNotes = (leadId: string, opts?: RequestOptions) =>
  opts
    ? apiClient.get<LeadNote[]>(`/leads/${leadId}/notes`, opts)
    : apiClient.get<LeadNote[]>(`/leads/${leadId}/notes`);
export const createLeadNote = (leadId: string, details: string) =>
  apiClient.post<LeadNote>(`/leads/${leadId}/notes`, { details });
export const updateLeadNote = (leadId: string, noteId: string, details: string) =>
  apiClient.put<LeadNote>(`/leads/${leadId}/notes/${noteId}`, { details });
export const deleteLeadNote = (leadId: string, noteId: string) =>
  apiClient.delete<{ id: string }>(`/leads/${leadId}/notes/${noteId}`);
