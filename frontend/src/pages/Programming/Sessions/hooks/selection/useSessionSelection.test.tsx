import type { PropsWithChildren } from 'react';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { makeProgramSession } from '../../../../../tests/factories/session';
import useSessionSelection from './useSessionSelection';

function Router({ children }: PropsWithChildren) {
  return <MemoryRouter
    initialEntries={['/programming/sessions?session=session-1']}
    future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
  >{children}</MemoryRouter>;
}

describe('useSessionSelection', () => {
  it('resolves the selected record from the active view owner', () => {
    const session = makeProgramSession();
    const { result } = renderHook(useSessionSelection, { wrapper: Router });

    act(() => result.current.setSelectedTableSession(session));
    expect(result.current.getSelectedSession('table')).toEqual(session);

    act(() => result.current.selectCalendarSession(session));
    expect(result.current.getSelectedSession('calendar')).toEqual(session);
  });

  it('replaces selected records from an authoritative mutation without changing selection', () => {
    const session = makeProgramSession();
    const saved = makeProgramSession({ theme: 'Updated theme' });
    const { result } = renderHook(useSessionSelection, { wrapper: Router });
    act(() => {
      result.current.setSelectedTableSession(session);
      result.current.setCalendarSessions([session]);
    });

    act(() => result.current.syncSelectedSession(saved));

    expect(result.current.selectedSessionId).toBe(session.id);
    expect(result.current.getSelectedSession('table')).toBe(saved);
    expect(result.current.getSelectedSession('calendar')).toBe(saved);
  });

  it('clears a removed selected session from every selection owner', () => {
    const session = makeProgramSession();
    const { result } = renderHook(useSessionSelection, { wrapper: Router });

    act(() => {
      result.current.setSelectedTableSession(session);
      result.current.setCalendarSessions([session]);
    });
    act(() => result.current.removeSelectedSession(session.id));

    expect(result.current.selectedSessionId).toBe('');
    expect(result.current.getSelectedSession('table')).toBeNull();
    expect(result.current.getSelectedSession('calendar')).toBeNull();
  });

  it('resolves a clicked table session immediately when switching records', () => {
    const first = makeProgramSession();
    const next = makeProgramSession({ id: 'session-2' });
    const { result } = renderHook(useSessionSelection, { wrapper: Router });

    act(() => result.current.selectSession(first));
    act(() => result.current.selectSession(next));

    expect(result.current.selectedSessionId).toBe(next.id);
    expect(result.current.getSelectedSession('table')).toBe(next);
  });

  it('clears resolved records when its buffered record disappears or is removed', () => {
    const session = makeProgramSession();
    const { result } = renderHook(useSessionSelection, { wrapper: Router });

    act(() => result.current.selectCalendarSession(session));
    act(() => result.current.setCalendarSessions([]));

    expect(result.current.getSelectedSession('calendar')).toBeNull();

    act(() => result.current.removeSelectedSession(session.id));
    expect(result.current.selectedSessionId).toBe('');
  });

  it('clears a session restored through navigation', () => {
    const { result } = renderHook(() => ({ selection: useSessionSelection(), navigate: useNavigate() }), { wrapper: Router });

    act(() => result.current.navigate('?session=restored-session'));

    act(() => result.current.selection.clearSelectedSession());
    expect(result.current.selection.selectedSessionId).toBe('');
  });
});
