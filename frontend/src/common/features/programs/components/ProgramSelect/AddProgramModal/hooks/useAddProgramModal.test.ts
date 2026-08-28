// Owns add-program validation, submission locking, success, failure, and reopen reset.
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createProgram } from '../../../../programs.api';
import useAddProgramModal from './useAddProgramModal';

vi.mock('../../../../programs.api', () => ({ createProgram: vi.fn() }));

describe('useAddProgramModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('runs only one create command while submission is pending', async () => {
    let resolveCreate!: (value: { id: string; name: string }) => void;
    vi.mocked(createProgram).mockReturnValue(new Promise(resolve => { resolveCreate = resolve; }) as never);
    const { result } = renderHook(() => useAddProgramModal({ isOpen: true, onCreated: vi.fn() }));
    const nameField = result.current.register('name');

    await act(async () => nameField.onChange({
      target: { name: 'name', value: 'Leadership' },
      type: 'change',
    }));

    await act(async () => {
      void result.current.submit({ preventDefault: vi.fn(), persist: vi.fn() } as never);
      void result.current.submit({ preventDefault: vi.fn(), persist: vi.fn() } as never);
    });

    expect(createProgram).toHaveBeenCalledTimes(1);
    await act(async () => resolveCreate({ id: 'program-1', name: 'Leadership' }));
  });
});
