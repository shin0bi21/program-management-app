// Owns Cohorts table columns and permission-aware row actions.
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import useCohortTable from './useCohortTable';

const callbacks = {
  onManageRoster: vi.fn(),
  onGenerateSessions: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
};

describe('useCohortTable', () => {
  it('provides the canonical data columns without actions for read-only users', () => {
    const { result } = renderHook(() => useCohortTable({ canWrite: false, ...callbacks }));

    expect(result.current.map(column => column.id)).toEqual([
      'program', 'cohort', 'start', 'end', 'status',
    ]);
  });

  it('adds a fixed actions column for writers', () => {
    const { result } = renderHook(() => useCohortTable({ canWrite: true, ...callbacks }));

    expect(result.current[result.current.length - 1]).toMatchObject({
      id: 'actions',
      enableResizing: false,
      enableHiding: false,
    });
  });
});
