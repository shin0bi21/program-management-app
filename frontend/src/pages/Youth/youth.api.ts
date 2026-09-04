import { apiClient } from '../../http/client';
import type { RequestOptions } from '../../http/client';
import type { YouthSessionNote } from '../Programming/Sessions/types';
import type { CursorPage, CursorRequest } from '../../query/types';
import type {
  YouthFilters,
  YouthProfileNote,
  YouthProfileNoteCategory,
  YouthSortKey,
} from './types';
import type { YouthProfile } from './types';

export interface SetYouthInput {
  id?: string;
  firstName: string;
  lastName: string;
  email?: string;
  dateOfBirth?: string;
  schoolId?: string;
  gradeLevel?: number;
  addresses?: Array<{ address: string }>;
  contacts?: Array<{
    phoneNumber: string;
    type: 'parent' | 'sibling' | 'guardian';
  }>;
}

export function getYouth(
  id: undefined,
  filters: YouthFilters,
  opts: RequestOptions | undefined,
  pagination: CursorRequest<YouthSortKey>,
): Promise<CursorPage<YouthProfile>>;
export function getYouth(id: string, filters?: YouthFilters, opts?: RequestOptions): Promise<YouthProfile | null>;
export function getYouth(id?: undefined, filters?: YouthFilters, opts?: RequestOptions): Promise<YouthProfile[]>;
export function getYouth(
  id?: string,
  filters: YouthFilters = {},
  opts?: RequestOptions,
  pagination?: CursorRequest<YouthSortKey>,
) {
  const params = new URLSearchParams();
  if (id) params.set('id', id);
  if (filters.search?.trim()) params.set('search', filters.search.trim());
  if (filters.statuses?.length) params.set('statuses', filters.statuses.join(','));
  if (filters.programIds?.length) params.set('programIds', filters.programIds.join(','));
  if (filters.cohortIds?.length) params.set('cohortIds', filters.cohortIds.join(','));
  if (pagination) {
    params.set('sort', pagination.key);
    params.set('direction', pagination.direction);
    params.set('limit', String(pagination.limit ?? 25));
    if (pagination.cursor) params.set('cursor', pagination.cursor);
  }
  const query = params.toString();
  const path = `/youth${query ? `?${query}` : ''}`;
  if (pagination) {
    return opts
      ? apiClient.get<CursorPage<YouthProfile>>(path, opts)
      : apiClient.get<CursorPage<YouthProfile>>(path);
  }
  if (id) {
    return opts
      ? apiClient.get<YouthProfile | null>(path, opts)
      : apiClient.get<YouthProfile | null>(path);
  }
  return opts
    ? apiClient.get<YouthProfile[]>(path, opts)
    : apiClient.get<YouthProfile[]>(path);
}

export function setYouth(data: SetYouthInput) {
  return data.id
    ? apiClient.put<YouthProfile>(`/youth/${data.id}`, data)
    : apiClient.post<YouthProfile>('/youth', data);
}

export function getYouthSessionNotes(id: string, opts?: RequestOptions) {
  const path = `/youth/${id}/session-notes`;
  return opts ? apiClient.get<YouthSessionNote[]>(path, opts) : apiClient.get<YouthSessionNote[]>(path);
}

export function inviteYouth(id: string, email: string) {
  return apiClient.post<YouthProfile['account']>(`/youth/${id}/invite`, { email });
}

export interface SetYouthProfileNoteInput {
  category: YouthProfileNoteCategory;
  details: string;
}

export function getYouthProfileNotes(id: string, opts?: RequestOptions) {
  const path = `/youth/${id}/notes`;
  return opts ? apiClient.get<YouthProfileNote[]>(path, opts) : apiClient.get<YouthProfileNote[]>(path);
}

export function setYouthProfileNote(id: string, data: SetYouthProfileNoteInput, noteId?: string) {
  return noteId
    ? apiClient.put<YouthProfileNote>(`/youth/${id}/notes/${noteId}`, data)
    : apiClient.post<YouthProfileNote>(`/youth/${id}/notes`, data);
}

export function deleteYouthProfileNote(id: string, noteId: string) {
  return apiClient.delete<void>(`/youth/${id}/notes/${noteId}`);
}
