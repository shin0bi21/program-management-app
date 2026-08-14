import { apiClient } from '../../../../http/client';
import type { RequestOptions } from '../../../../http/client';
import type { YouthFilters, YouthProfile, SetYouthInput, YouthProfileNote, YouthProfileNoteCategory, YouthSortKey } from '../../../types/youth';
import type { CursorPage, CursorRequest } from '../../../types/pagination';
import type { YouthSessionNote } from '../../../types/cohort';

export function getYouth(id: string, filters?: YouthFilters, opts?: RequestOptions): Promise<YouthProfile | null>;
export function getYouth(id?: undefined, filters?: YouthFilters, opts?: RequestOptions): Promise<YouthProfile[]>;
export function getYouth(id: undefined, filters: YouthFilters, opts: RequestOptions | undefined, pagination: CursorRequest<YouthSortKey>): Promise<YouthProfile[] | CursorPage<YouthProfile>>;
export function getYouth(id?: string, filters: YouthFilters = {}, opts?: RequestOptions, pagination?: CursorRequest<YouthSortKey>) {
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
  return opts
    ? apiClient.get<YouthProfile | YouthProfile[] | CursorPage<YouthProfile> | null>(path, opts)
    : apiClient.get<YouthProfile | YouthProfile[] | CursorPage<YouthProfile> | null>(path);
}

export function setYouth(data: SetYouthInput) {
  return apiClient.post<YouthProfile>('/youth', data);
}

export function getYouthSessionNotes(id: string, opts?: RequestOptions) {
  const path = `/youth/${id}/session-notes`;
  return opts ? apiClient.get<YouthSessionNote[]>(path, opts) : apiClient.get<YouthSessionNote[]>(path);
}

export function inviteYouth(id: string, email: string) {
  return apiClient.post<YouthProfile['account']>(`/youth/${id}/invite`, { email });
}

export interface SetYouthProfileNoteInput { category: YouthProfileNoteCategory; title: string; details: string | null }
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
