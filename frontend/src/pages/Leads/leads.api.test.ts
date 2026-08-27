// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '../../http/client';
import {
  createLead,
  deleteLeadNote,
  getLeadNotes,
  getLeads,
  setLeadNote,
  signUpLead,
  updateLead,
  updateLeadStatus,
} from './leads.api';

vi.mock('../../http/client', () => ({
  apiClient: { delete: vi.fn(), get: vi.fn(), patch: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

describe('leads API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('serializes filters, sorting, pagination, and cancellation options', () => {
    const options = { signal: new AbortController().signal };

    getLeads(
      { search: ' Avery ', statuses: ['new', 'eligible'], programIds: ['program-1'], submitterRoles: ['parent', 'youth'] },
      { key: 'created', direction: 'desc', limit: 25, cursor: 'cursor-2' },
      options,
    );

    expect(apiClient.get).toHaveBeenCalledWith(
      '/leads?search=Avery&statuses=new%2Celigible&programIds=program-1&submitterRoles=parent%2Cyouth&sort=created&direction=desc&limit=25&cursor=cursor-2',
      options,
    );
  });

  it('uses focused status, signup, and note endpoints', () => {
    updateLeadStatus('lead-1', 'eligible');
    signUpLead('lead-1', 'cohort-1', 'health');
    setLeadNote('lead-1', 'Called guardian.');
    setLeadNote('lead-1', 'Meeting booked.', 'note-1');
    deleteLeadNote('lead-1', 'note-1');

    expect(apiClient.patch).toHaveBeenCalledWith('/leads/lead-1/status', { status: 'eligible' });
    expect(apiClient.post).toHaveBeenNthCalledWith(1, '/leads/lead-1/sign-up', {
      cohortId: 'cohort-1',
      noteCategory: 'health',
    });
    expect(apiClient.post).toHaveBeenNthCalledWith(2, '/leads/lead-1/notes', {
      details: 'Called guardian.',
    });
    expect(apiClient.put).toHaveBeenCalledWith('/leads/lead-1/notes/note-1', {
      details: 'Meeting booked.',
    });
    expect(apiClient.delete).toHaveBeenCalledWith('/leads/lead-1/notes/note-1');
  });

  it('uses the Lead collection and record endpoints for create and update', () => {
    const input = {
      youthFirstName: 'Maya',
      youthLastName: 'Thompson',
      age: 15,
      school: 'Central High',
      contactPhoneNumber: '416-555-0100',
      contactRelationship: 'parent' as const,
      discoverySource: 'school' as const,
      notes: 'Interested in summer programming.',
    };

    createLead(input);
    updateLead('lead-1', input);

    expect(apiClient.post).toHaveBeenCalledWith('/leads', input);
    expect(apiClient.put).toHaveBeenCalledWith('/leads/lead-1', input);
  });

  it('loads Lead notes with optional cancellation', () => {
    const options = { signal: new AbortController().signal };

    getLeadNotes('lead-1');
    getLeadNotes('lead-2', options);

    expect(apiClient.get).toHaveBeenNthCalledWith(1, '/leads/lead-1/notes');
    expect(apiClient.get).toHaveBeenNthCalledWith(2, '/leads/lead-2/notes', options);
  });
});
