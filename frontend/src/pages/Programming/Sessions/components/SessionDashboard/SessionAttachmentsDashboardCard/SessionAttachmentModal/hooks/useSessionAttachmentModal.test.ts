import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSessionAttachment } from '../../../../../../../../common/features/programming/api/sessions.api';
import { makeCohortSession } from '../../../../../../../../tests/factories/session';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../../../../tests/queryClientTestUtils';
import { useSessionAttachmentModal } from './useSessionAttachmentModal';

vi.mock('../../../../../../../../common/features/programming/api/sessions.api', () => ({
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

  it('locks same-tick uploads until the save workflow settles', async () => {
    let resolveCreate!: () => void;
    vi.mocked(createSessionAttachment).mockReturnValue(new Promise(resolve => {
      resolveCreate = () => resolve({} as never);
    }));
    const onSaved = vi.fn().mockResolvedValue(undefined);
    const wrapper = createQueryClientWrapper(createTestQueryClient());
    const session = makeCohortSession();
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
