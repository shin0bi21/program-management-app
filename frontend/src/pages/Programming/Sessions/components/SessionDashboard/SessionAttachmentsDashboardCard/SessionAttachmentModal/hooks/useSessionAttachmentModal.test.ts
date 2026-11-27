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
      result.current.setValue('title', ' Workshop photo ');
      result.current.setValue('file', Object.assign([file], { item: (index: number) => index === 0 ? file : null }));
      result.current.toggleYouth('youth-1');
    });

    await act(() => result.current.submit());

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
    act(() => result.current.setValue('title', ' Workshop photo '));

    await act(() => result.current.submit());

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
    const file = new File(['photo'], 'workshop.png');
    act(() => result.current.setValue('file', Object.assign([file], { item: (index: number) => index === 0 ? file : null })));

    await act(() => result.current.submit());
    expect(result.current).toMatchObject({ submitStatus: 'error', statusMessage: 'Upload failed' });

    await act(() => result.current.submit());
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
    act(() => result.current.setValue('file', Object.assign([file], { item: (index: number) => index === 0 ? file : null })));
    let firstSubmit!: Promise<void>;
    act(() => {
      firstSubmit = result.current.submit();
      void result.current.submit();
    });

    await waitFor(() => expect(result.current.submissionComplete).toBe(true));
    expect(createSessionAttachment).toHaveBeenCalledOnce();
    resolveCreate();
    await act(async () => firstSubmit);

    expect(onSaved).toHaveBeenCalledOnce();
    await waitFor(() => expect(result.current.submitStatus).toBe('success'));
  });
});
