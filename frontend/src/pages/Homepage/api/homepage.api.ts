import { apiClient } from '../../../common/api/http/client';

export type CohortInterestPayload = {
  youthFirstName: string;
  youthLastName: string;
  age: number;
  school: string;
  email?: string;
  phoneNumber?: string;
  contactFirstName: string;
  contactLastName: string;
  contactPhoneNumber: string;
  contactRelationship: 'parent' | 'sibling' | 'guardian';
  discoverySource: 'online' | 'friend_family' | 'school' | 'community_outreach' | 'other';
  message?: string;
};

export function submitCohortInterest(payload: CohortInterestPayload) {
  return apiClient.post<{ message: string }>('/public/cohort-interest', payload, { auth: false });
}
