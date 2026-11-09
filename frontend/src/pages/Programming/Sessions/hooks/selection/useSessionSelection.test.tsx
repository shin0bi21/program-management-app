import type { PropsWithChildren } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { makeProgramSession } from '../../../../../tests/factories/session';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../tests/queryClientTestUtils';
import useSessionSelection from './useSessionSelection';

function renderSelection() {
  const client = createTestQueryClient();
  const QueryProvider = createQueryClientWrapper(client);
  function Wrapper({ children }: PropsWithChildren) {
    return <QueryProvider><MemoryRouter initialEntries={['/programming/sessions?session=session-1']}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{children}</MemoryRouter></QueryProvider>;
  }
  return { client, ...renderHook(() => ({ selection: useSessionSelection(), navigate: useNavigate() }), { wrapper: Wrapper }) };
}

describe('useSessionSelection', () => {
  it('receives the loaded URL target and follows subsequent saves', async () => {
    const { result } = renderSelection();
    expect(result.current.selection.selectedSession).toBeNull();
    const session = makeProgramSession();
    act(() => result.current.selection.syncSelectedSession(session));
    await waitFor(() => expect(result.current.selection.selectedSession).toEqual(session));

    const saved = makeProgramSession({ theme: 'Updated theme' });
    act(() => result.current.selection.syncSelectedSession(saved));
    await waitFor(() => expect(result.current.selection.selectedSession).toEqual(saved));
    expect(result.current.selection.selectedSessionId).toBe(session.id);
  });

  it('keeps the clicked row as selection context', async () => {
    const { result } = renderSelection();
    const next = makeProgramSession({ id: 'session-2' });
    act(() => { result.current.selection.selectSession(next); });
    await waitFor(() => expect(result.current.selection.selectedSession).toEqual(next));
    expect(result.current.selection.selectedSessionId).toBe(next.id);
  });

  it('removes a deleted selection from the URL', async () => {
    const { result } = renderSelection();
    act(() => result.current.selection.syncSelectedSession(makeProgramSession()));
    act(() => { result.current.selection.removeSelectedSession('session-1'); });
    await waitFor(() => expect(result.current.selection.selectedSession).toBeNull());
    expect(result.current.selection.selectedSessionId).toBe('');
  });

  it('clears a session restored through navigation', () => {
    const { result } = renderSelection();
    act(() => result.current.navigate('?session=restored-session'));
    act(() => result.current.selection.clearSelectedSession());
    expect(result.current.selection.selectedSessionId).toBe('');
  });
});
