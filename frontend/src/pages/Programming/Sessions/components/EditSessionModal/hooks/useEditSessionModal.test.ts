import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { updateSession } from '../../../../../../common/features/programming/api/sessions.api';
import { makeCohortSession } from '../../../../../../tests/factories/session';
import { useEditSessionModal } from './useEditSessionModal';

vi.mock('../../../../../../common/features/programming/api/sessions.api', () => ({ updateSession: vi.fn() }));
vi.mock('../../../../common/hooks/useSessionTypes', () => ({
  useSessionTypes: () => ({ sessionTypes: [] }),
}));

function makeSubmitEvent() {
  const form = document.createElement('form');
  for (const [name, value] of [
    ['theme', ' Career Stories '],
    ['startsAt', '2026-08-10T13:00'],
    ['endsAt', '2026-08-10T15:00'],
    ['description', ''],
  ]) {
    const input = document.createElement('input');
    input.name = name;
    input.value = value;
    form.append(input);
  }
  return { preventDefault: vi.fn(), currentTarget: form } as never;
}

describe('useEditSessionModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('locks same-tick submissions until the save workflow settles', async () => {
    let resolveUpdate!: () => void;
    vi.mocked(updateSession).mockReturnValue(new Promise(resolve => {
      resolveUpdate = () => resolve(makeCohortSession());
    }));
    const onUpdated = vi.fn().mockResolvedValue(undefined);
    const session = makeCohortSession();
    const { result } = renderHook(() => useEditSessionModal(session, onUpdated));

    await act(async () => result.current.setSessionTypeId('type-2'));
    let firstSubmit!: Promise<void>;
    act(() => {
      firstSubmit = result.current.submit(makeSubmitEvent());
      void result.current.submit(makeSubmitEvent());
    });

    expect(updateSession).toHaveBeenCalledOnce();
    await waitFor(() => expect(result.current.submissionComplete).toBe(true));
    resolveUpdate();
    await act(async () => firstSubmit);

    expect(onUpdated).toHaveBeenCalledOnce();
    await waitFor(() => expect(result.current.status).toBe('success'));
  });
});
