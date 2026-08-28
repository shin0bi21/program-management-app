// Owns Sessions table columns and permission-aware row actions.
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import useSessionTable from './useSessionTable';

const callbacks = {
  onTakeAttendance: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
};

describe('useSessionTable', () => {
  it('provides the canonical data columns without actions for read-only users', () => {
    const { result } = renderHook(() => useSessionTable({
      canWriteAttendance: false,
      canWriteSessions: false,
      ...callbacks,
    }));

    expect(result.current.map(column => column.id)).toEqual([
      'program', 'cohort', 'theme', 'date', 'time', 'type', 'status',
    ]);
  });

  it('adds a fixed actions column when either workflow is writable', () => {
    const { result } = renderHook(() => useSessionTable({
      canWriteAttendance: true,
      canWriteSessions: false,
      ...callbacks,
    }));

    expect(result.current[result.current.length - 1]).toMatchObject({
      id: 'actions',
      enableResizing: false,
      enableHiding: false,
    });
  });
});
