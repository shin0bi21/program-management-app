import { apiClient } from '../../../common/api/http/client';

export type CohortInterestPayload = {
  youthFirstName: string;
  youthLastName: string;
  age: number;
  school: string;
  contactFirstName: string;
  contactLastName: string;
  contactPhoneNumber: string;
  contactRelationship: 'parent' | 'sibling' | 'guardian' | 'emergency';
  discoverySource: 'online' | 'friend_family' | 'school' | 'community_outreach' | 'other';
  notes?: string;
};

export function submitCohortInterest(payload: CohortInterestPayload) {
  return apiClient.post<{ message: string }>('/public/cohort-interest', payload, { auth: false });
}
