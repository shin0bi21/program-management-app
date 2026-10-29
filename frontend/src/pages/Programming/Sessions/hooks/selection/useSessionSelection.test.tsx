import type { PropsWithChildren } from 'react';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { makeCohortSession } from '../../../../../tests/factories/session';
import useSessionSelection from './useSessionSelection';

function Router({ children }: PropsWithChildren) {
  return <MemoryRouter
    initialEntries={['/programming/sessions?session=session-1']}
    future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
  >{children}</MemoryRouter>;
}

describe('useSessionSelection', () => {
  it('resolves the selected record from the active view owner', () => {
    const session = makeCohortSession();
    const { result } = renderHook(useSessionSelection, { wrapper: Router });

    act(() => result.current.setSelectedTableSession(session));
    expect(result.current.getSelectedSession('table')).toEqual(session);

    act(() => result.current.selectCalendarSession(session));
    expect(result.current.getSelectedSession('calendar')).toEqual(session);
  });

  it('clears a removed selected session from every selection owner', () => {
    const session = makeCohortSession();
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
    const first = makeCohortSession();
    const next = makeCohortSession({ id: 'session-2' });
    const { result } = renderHook(useSessionSelection, { wrapper: Router });

    act(() => result.current.selectSession(first));
    act(() => result.current.selectSession(next));

    expect(result.current.selectedSessionId).toBe(next.id);
    expect(result.current.getSelectedSession('table')).toBe(next);
    expect(result.current.dashboardMode).toBe('session');
  });

  it('keeps the Session dashboard when its buffered record disappears or is removed', () => {
    const session = makeCohortSession();
    const { result } = renderHook(useSessionSelection, { wrapper: Router });

    act(() => result.current.selectCalendarSession(session));
    act(() => result.current.setCalendarSessions([]));

    expect(result.current.getSelectedSession('calendar')).toBeNull();
    expect(result.current.dashboardMode).toBe('session');

    act(() => result.current.removeSelectedSession(session.id));
    expect(result.current.dashboardMode).toBe('session');
    expect(result.current.selectedSessionId).toBe('');

    act(() => result.current.showProgramDashboard());
    expect(result.current.dashboardMode).toBe('program');
  });

  it('retains a session restored through navigation when that selection clears', () => {
    const { result } = renderHook(() => ({ selection: useSessionSelection(), navigate: useNavigate() }), { wrapper: Router });
    act(() => result.current.selection.showProgramDashboard());
    expect(result.current.selection.dashboardMode).toBe('program');

    act(() => result.current.navigate('?session=restored-session'));
    expect(result.current.selection.dashboardMode).toBe('session');

    act(() => result.current.selection.clearSelectedSession());
    expect(result.current.selection.selectedSessionId).toBe('');
    expect(result.current.selection.dashboardMode).toBe('session');
  });

});
