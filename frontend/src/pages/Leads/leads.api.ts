import { apiClient } from '../../http/client';
import type { RequestOptions } from '../../http/client';
import type { CursorPage, CursorRequest } from '../../common/types/pagination';
import type {
  DiscoverySource,
  Lead,
  LeadFilters,
  LeadNote,
  LeadSortKey,
  LeadStatus,
  LeadRelationship,
} from './types';

interface CreateLeadInput {
  youthFirstName: string;
  youthLastName: string;
  age: number;
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
    params.set('limit', String(pagination.limit ?? 25));
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
export const updateLeadStatus = (id: string, status: LeadStatus) =>
  apiClient.patch<Lead>(`/leads/${id}/status`, { status });
export const deleteLead = (id: string) => apiClient.delete<{ id: string }>(`/leads/${id}`);
export const signUpLead = (
  id: string,
  cohortId: string | null,
  noteCategory?: 'general' | 'health' | 'preference',
) =>
  apiClient.post<Lead>(`/leads/${id}/sign-up`, { cohortId, ...(noteCategory && { noteCategory }) });
export const getLeadNotes = (leadId: string, opts?: RequestOptions) =>
  opts
    ? apiClient.get<LeadNote[]>(`/leads/${leadId}/notes`, opts)
    : apiClient.get<LeadNote[]>(`/leads/${leadId}/notes`);
export const setLeadNote = (leadId: string, details: string, noteId?: string) => noteId
  ? apiClient.put<LeadNote>(`/leads/${leadId}/notes/${noteId}`, { details })
  : apiClient.post<LeadNote>(`/leads/${leadId}/notes`, { details });
export const deleteLeadNote = (leadId: string, noteId: string) =>
  apiClient.delete(`/leads/${leadId}/notes/${noteId}`);
