import { apiClient } from '../../../../http/client';
import type { RequestOptions } from '../../../../http/client';
import type { ColumnWidths } from '../../../types/pagination';

export interface PreferenceValues {
  'account-filters': {
    statuses: Array<'active' | 'invited' | 'inactive'>;
    roles: Array<'admin' | 'staff' | 'youth'>;
    sorting?: { key: 'name' | 'email' | 'role' | 'status' | 'createdAt'; direction: 'asc' | 'desc' };
    columnWidths?: ColumnWidths<'name' | 'email' | 'role' | 'status' | 'createdAt'>;
  };
  'youth-profile-filters': {
    statuses: Array<'active' | 'inactive'>;
    programIds: string[];
    sorting?: { key: 'firstName' | 'lastName' | 'age' | 'school' | 'grade' | 'program' | 'status'; direction: 'asc' | 'desc' };
    columnWidths?: ColumnWidths<'firstName' | 'lastName' | 'age' | 'school' | 'grade' | 'program' | 'status'>;
  };
  'session-filters': {
    view: 'calendar' | 'list';
    programIds: string[];
    cohortId: string | null;
    sessionTypeIds: string[];
    statuses: Array<'upcoming' | 'completed'>;
    sorting?: { key: 'program' | 'cohort' | 'theme' | 'date' | 'time' | 'type' | 'status'; direction: 'asc' | 'desc' };
    columnWidths?: ColumnWidths<'program' | 'cohort' | 'theme' | 'date' | 'time' | 'type' | 'status'>;
  };
  'timesheet-filters': {
    view: 'calendar' | 'list';
    staffIds: string[];
    programIds: string[];
    categories: Array<'program_delivery' | 'planning_prep' | 'meeting' | 'administration' | 'outreach' | 'maintenance' | 'other'>;
    cycleId: string | null;
    columnWidths?: ColumnWidths<'date' | 'staff' | 'program' | 'cycle' | 'category' | 'task' | 'hours' | 'note'>;
  };
  'task-filters': {
    view?: 'calendar' | 'list';
    programIds: string[];
    cycleIds: string[];
    categories: Array<'program_delivery' | 'planning_prep' | 'meeting' | 'administration' | 'outreach' | 'maintenance' | 'other'>;
    statuses: Array<'todo' | 'in_progress' | 'completed' | 'cancelled'>;
    columnWidths?: ColumnWidths<'title' | 'category' | 'assignee' | 'program' | 'cycle' | 'startDate' | 'dueDate' | 'status'>;
  };
  'cohort-filters': {
    programId: string | null;
    status: 'active' | 'upcoming' | 'completed' | null;
    sorting?: { key: 'program' | 'cohort' | 'start' | 'end' | 'status'; direction: 'asc' | 'desc' };
    columnWidths?: ColumnWidths<'program' | 'cohort' | 'start' | 'end' | 'status'>;
  };
  'lead-filters': {
    statuses: Array<'new' | 'contacted' | 'eligible' | 'ineligible' | 'signed_up'>;
    programIds: string[];
    sorting?: { key: 'name' | 'school' | 'program' | 'status' | 'createdAt'; direction: 'asc' | 'desc' };
    columnWidths?: ColumnWidths<'name' | 'school' | 'program' | 'status' | 'created'>;
  };
  'expression-interest-filters': {
    statuses: Array<'new' | 'reviewed' | 'contacted' | 'converted' | 'signed_up' | 'lost' | 'spam'>;
    programIds: string[];
    sorting?: { key: 'name' | 'age' | 'school' | 'program' | 'submittedByRole' | 'createdAt' | 'status'; direction: 'asc' | 'desc' };
    columnWidths?: ColumnWidths<'youthName' | 'age' | 'school' | 'program' | 'submittedByRole' | 'submittedAt' | 'status'>;
  };
}

export type PreferenceKey = keyof PreferenceValues;

export function getPreference<K extends PreferenceKey>(key: K, opts?: RequestOptions) {
  return opts
    ? apiClient.get<PreferenceValues[K] | null>(`/preferences/${key}`, opts)
    : apiClient.get<PreferenceValues[K] | null>(`/preferences/${key}`);
}

export function setPreference<K extends PreferenceKey>(key: K, value: PreferenceValues[K]) {
  return apiClient.put<PreferenceValues[K]>(`/preferences/${key}`, value);
}
