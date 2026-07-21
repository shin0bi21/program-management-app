import { apiClient } from '../../../common/api/http/client';
import type { OutreachFormValues } from '../../../common/components/OutreachForm/outreachFormSchema';

export type ExpressionOfInterestPayload = Omit<OutreachFormValues, 'notes'> & { notes?: string };

export function submitExpressionOfInterest(payload: ExpressionOfInterestPayload) {
  return apiClient.post<{ message: string }>('/public/expressions-of-interest', payload, { auth: false });
}
