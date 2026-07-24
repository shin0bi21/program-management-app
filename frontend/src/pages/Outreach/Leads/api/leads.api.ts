import { apiClient } from '../../../../common/api/http/client';
import type { CreateLeadInput, Lead, LeadFilters, LeadStatus, UpdateLeadInput } from '../types';

export const getLeads = (filters: LeadFilters = {}) => {
  const params = new URLSearchParams();
  if (filters.search?.trim()) params.set('search', filters.search.trim());
  if (filters.statuses?.length) params.set('statuses', filters.statuses.join(','));
  if (filters.programIds?.length) params.set('programIds', filters.programIds.join(','));
  const query = params.toString();
  return apiClient.get<Lead[]>(`/leads${query ? `?${query}` : ''}`);
};
export const createLead = (data: CreateLeadInput) => apiClient.post<Lead>('/leads', data);
export const updateLead = (id: string, data: UpdateLeadInput) => apiClient.put<Lead>(`/leads/${id}`, data);
export const updateLeadStatus = (id: string, status: LeadStatus) =>
  apiClient.patch<Lead>(`/leads/${id}/status`, { status });
export const signUpLead = (id: string, cohortId: string | null) =>
  apiClient.post<Lead>(`/leads/${id}/sign-up`, { cohortId });
