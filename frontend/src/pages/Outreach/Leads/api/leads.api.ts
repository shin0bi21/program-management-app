import { apiClient } from '../../../../common/api/http/client';
import type { CreateLeadInput, Lead, LeadStatus } from '../types';

export const getLeads = () => apiClient.get<Lead[]>('/leads');
export const createLead = (data: CreateLeadInput) => apiClient.post<Lead>('/leads', data);
export const updateLeadStatus = (id: string, status: LeadStatus) =>
  apiClient.patch<Lead>(`/leads/${id}/status`, { status });
