import { render, renderHook } from '@testing-library/react';
import type { CellContext, ColumnDef } from '@tanstack/react-table';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActionItem } from '../../../../../common/components/ActionsMenu/ActionsMenu';
import type { Lead } from '../../../types';
import useLeadTable from './useLeadTable';

const menu = vi.hoisted<{ items: ActionItem[] }>(() => ({ items: [] }));

vi.mock('../../../../../common/components/ActionsMenu/ActionsMenu', () => ({
  default: ({ items }: { items: ActionItem[] }) => {
    menu.items = items;
    return <div data-testid="lead-actions" />;
  },
}));

const lead: Lead = {
  id: 'lead-1', origin: 'external', submittedByRole: 'parent', convertedYouthId: null,
  youthFirstName: 'Avery', youthLastName: 'Outreach', age: 14, dateOfBirth: `${new Date().getFullYear() - 14}-01-01`, school: 'Test School',
  recommendedProgramId: 'program-1', recommendedProgramName: 'Future Ready',
  contactPhoneNumber: '416-555-0142', contactRelationship: 'guardian',
  discoverySource: 'community_outreach', notes: null, status: 'new',
  statusUpdatedAt: '2026-08-01T12:00:00.000Z', createdAt: '2026-08-01T12:00:00.000Z',
};

function renderCell(column: ColumnDef<Lead>, value: Lead) {
  if (typeof column.cell !== 'function') throw new Error(`Column ${column.id} has no cell renderer`);
  return column.cell({ row: { original: value } } as CellContext<Lead, unknown>);
}

describe('useLeadTable', () => {
  beforeEach(() => {
    menu.items = [];
    vi.clearAllMocks();
  });

  it('owns origin-specific data columns without actions for read-only users', () => {
    const callbacks = { onEdit: vi.fn(), onDelete: vi.fn(), onSignUp: vi.fn(), onStatusChange: vi.fn() };
    const external = renderHook(() => useLeadTable({ origin: 'external', canWrite: false, ...callbacks }));
    const internal = renderHook(() => useLeadTable({ origin: 'internal', canWrite: false, ...callbacks }));

    expect(external.result.current.columns.some(column => column.id === 'submittedByRole')).toBe(true);
    expect(internal.result.current.columns.some(column => column.id === 'submittedByRole')).toBe(false);
    expect(external.result.current.columns.some(column => column.id === 'actions')).toBe(false);
    expect(internal.result.current.columns.some(column => column.id === 'actions')).toBe(false);
  });

  it('maps writable row actions and emits exact lead commands', () => {
    const callbacks = { onEdit: vi.fn(), onDelete: vi.fn(), onSignUp: vi.fn(), onStatusChange: vi.fn() };
    const { result } = renderHook(() => useLeadTable({ origin: 'external', canWrite: true, ...callbacks }));
    const actionsColumn = result.current.columns.find(column => column.id === 'actions')!;

    render(<>{renderCell(actionsColumn, lead)}</>);

    menu.items.find(item => item.id === 'edit')!.onClick();
    menu.items.find(item => item.id === 'delete')!.onClick();
    menu.items.find(item => item.id === 'sign-up')!.onClick();
    menu.items.find(item => item.id === 'contacted')!.onClick();
    expect(callbacks.onEdit).toHaveBeenCalledWith(lead);
    expect(callbacks.onDelete).toHaveBeenCalledWith(lead);
    expect(callbacks.onSignUp).toHaveBeenCalledWith(lead);
    expect(callbacks.onStatusChange).toHaveBeenCalledWith(lead, 'contacted');
  });

  it('omits row actions after sign-up', () => {
    const callbacks = { onEdit: vi.fn(), onDelete: vi.fn(), onSignUp: vi.fn(), onStatusChange: vi.fn() };
    const { result } = renderHook(() => useLeadTable({ origin: 'external', canWrite: true, ...callbacks }));
    const actionsColumn = result.current.columns.find(column => column.id === 'actions')!;

    expect(renderCell(actionsColumn, { ...lead, status: 'signed_up' })).toBeNull();
  });

  it.each(['new', 'contacted', 'eligible', 'ineligible', 'deferred', 'closed'] as const)(
    'does not offer Mark New for a %s lead',
    status => {
      const callbacks = { onEdit: vi.fn(), onDelete: vi.fn(), onSignUp: vi.fn(), onStatusChange: vi.fn() };
      const { result } = renderHook(() => useLeadTable({ origin: 'external', canWrite: true, ...callbacks }));
      const actionsColumn = result.current.columns.find(column => column.id === 'actions')!;

      render(<>{renderCell(actionsColumn, { ...lead, status })}</>);

      expect(menu.items.some(item => item.id === 'new')).toBe(false);
      expect(menu.items.some(item => item.id === status)).toBe(false);
    },
  );
});
