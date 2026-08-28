// Owns URL-backed Sessions selection and table/calendar reconciliation.
import type { PropsWithChildren } from 'react';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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
});
