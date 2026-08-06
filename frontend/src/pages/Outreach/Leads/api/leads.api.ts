import { apiClient } from '../../../../common/api/http/client';
import type { RequestOptions } from '../../../../common/api/http/client';
import type { CreateLeadInput, Lead, LeadFilters, LeadStatus, UpdateLeadInput } from '../types';

export const getLeads = (filters: LeadFilters = {}, opts?: RequestOptions) => {
  const params = new URLSearchParams();
  if (filters.search?.trim()) params.set('search', filters.search.trim());
  if (filters.statuses?.length) params.set('statuses', filters.statuses.join(','));
  if (filters.programIds?.length) params.set('programIds', filters.programIds.join(','));
  const query = params.toString();
  const path = `/leads${query ? `?${query}` : ''}`;
  return opts ? apiClient.get<Lead[]>(path, opts) : apiClient.get<Lead[]>(path);
};
export const createLead = (data: CreateLeadInput) => apiClient.post<Lead>('/leads', data);
export const updateLead = (id: string, data: UpdateLeadInput) => apiClient.put<Lead>(`/leads/${id}`, data);
export const updateLeadStatus = (id: string, status: LeadStatus) =>
  apiClient.patch<Lead>(`/leads/${id}/status`, { status });
export const signUpLead = (id: string, cohortId: string | null, noteCategory?: 'general' | 'health' | 'preference') =>
  apiClient.post<Lead>(`/leads/${id}/sign-up`, { cohortId, ...(noteCategory && { noteCategory }) });
