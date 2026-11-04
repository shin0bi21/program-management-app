import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSessionAttachment, updateSessionAttachment } from '../../../../../sessions.api';
import type { SessionAttachment } from '../../../../../types';
import { makeProgramSession } from '../../../../../../../../tests/factories/session';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../../../../tests/queryClientTestUtils';
import { useSessionAttachmentModal } from './useSessionAttachmentModal';

vi.mock('../../../../../sessions.api', () => ({
  createSessionAttachment: vi.fn(),
  getSessionRoster: vi.fn().mockResolvedValue([]),
  updateSessionAttachment: vi.fn(),
}));

function makeSubmitEvent() {
  const form = document.createElement('form');
  for (const [name, value] of [['title', ' Workshop photo '], ['description', '']]) {
    const input = document.createElement('input');
    input.name = name;
    input.value = value;
    form.append(input);
  }
  return { preventDefault: vi.fn(), currentTarget: form } as never;
}

describe('useSessionAttachmentModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('normalizes upload metadata, selected youth, and the file command', async () => {
    vi.mocked(createSessionAttachment).mockResolvedValue({} as never);
    const onSaved = vi.fn();
    const wrapper = createQueryClientWrapper(createTestQueryClient());
    const session = makeProgramSession();
    const { result } = renderHook(() => useSessionAttachmentModal({
      queryKey: ['sessions'], session, attachment: null, onSaved,
    }), { wrapper });
    const file = new File(['photo'], 'workshop.png', { type: 'image/png' });
    act(() => {
      result.current.setSelectedFile(file);
      result.current.toggleYouth('youth-1');
    });

    await act(() => result.current.submit(makeSubmitEvent()));

    expect(createSessionAttachment).toHaveBeenCalledWith(session.id, {
      title: 'Workshop photo',
      description: null,
      youthIds: ['youth-1'],
      file,
    });
    expect(onSaved).toHaveBeenCalledOnce();
    expect(result.current.submitStatus).toBe('success');
  });

  it('initializes an edit target and sends metadata without a file', async () => {
    const session = makeProgramSession();
    const attachment = {
      id: 'attachment-1',
      sessionId: session.id,
      title: 'Original',
      description: null,
      youth: [{ youthId: 'youth-1', firstName: 'Maya', lastName: 'Thompson' }],
    } as SessionAttachment;
    vi.mocked(updateSessionAttachment).mockResolvedValue({} as never);
    const onSaved = vi.fn();
    const wrapper = createQueryClientWrapper(createTestQueryClient());
    const { result } = renderHook(() => useSessionAttachmentModal({
      queryKey: ['sessions'], session, attachment, onSaved,
    }), { wrapper });
    await waitFor(() => expect(result.current.selectedYouthIds).toEqual(['youth-1']));

    await act(() => result.current.submit(makeSubmitEvent()));

    expect(updateSessionAttachment).toHaveBeenCalledWith(session.id, attachment.id, {
      title: 'Workshop photo',
      description: null,
      youthIds: ['youth-1'],
    });
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it('reports upload failures and permits retry', async () => {
    vi.mocked(createSessionAttachment)
      .mockRejectedValueOnce(new Error('Upload failed'))
      .mockResolvedValueOnce({} as never);
    const wrapper = createQueryClientWrapper(createTestQueryClient());
    const session = makeProgramSession();
    const onSaved = vi.fn();
    const { result } = renderHook(() => useSessionAttachmentModal({
      queryKey: ['sessions'], session, attachment: null, onSaved,
    }), { wrapper });
    act(() => result.current.setSelectedFile(new File(['photo'], 'workshop.png')));

    await act(() => result.current.submit(makeSubmitEvent()));
    expect(result.current).toMatchObject({ submitStatus: 'error', statusMessage: 'Upload failed' });

    await act(() => result.current.submit(makeSubmitEvent()));
    expect(createSessionAttachment).toHaveBeenCalledTimes(2);
    expect(result.current.submitStatus).toBe('success');
  });

  it('locks same-tick uploads until the save workflow settles', async () => {
    let resolveCreate!: () => void;
    vi.mocked(createSessionAttachment).mockReturnValue(new Promise(resolve => {
      resolveCreate = () => resolve({} as never);
    }));
    const onSaved = vi.fn().mockResolvedValue(undefined);
    const wrapper = createQueryClientWrapper(createTestQueryClient());
    const session = makeProgramSession();
    const { result } = renderHook(() => useSessionAttachmentModal({
      queryKey: ['sessions'],
      session,
      attachment: null,
      onSaved,
    }), { wrapper });

    const file = new File(['photo'], 'workshop.png', { type: 'image/png' });
    await act(async () => result.current.setSelectedFile(file));
    let firstSubmit!: Promise<void>;
    act(() => {
      firstSubmit = result.current.submit(makeSubmitEvent());
      void result.current.submit(makeSubmitEvent());
    });

    expect(createSessionAttachment).toHaveBeenCalledOnce();
    await waitFor(() => expect(result.current.submissionComplete).toBe(true));
    resolveCreate();
    await act(async () => firstSubmit);

    expect(onSaved).toHaveBeenCalledOnce();
    await waitFor(() => expect(result.current.submitStatus).toBe('success'));
  });
});
