import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TableColumnDef } from '../Table/Table.types';
import PageContainer from './PageContainer';

const columns: TableColumnDef<{ name: string; status: string }>[] = [
  { id: 'name', header: 'Name', accessorKey: 'name' },
  { id: 'status', header: 'Status', accessorKey: 'status' },
];

function makeControls() {
  return {
    search: {
      value: 'draft',
      appliedValue: 'saved',
      setValue: vi.fn(),
      apply: vi.fn(),
      clear: vi.fn(),
    },
    filters: {
      definitions: [{ id: 'statuses', label: 'Status', options: [{ value: 'active', label: 'Active' }] }],
      values: { statuses: ['active'] },
      apply: vi.fn(),
      clear: vi.fn(),
    },
    table: { hiddenColumns: [], setHiddenColumns: vi.fn() },
    ready: true,
    view: 'table' as 'table' | 'calendar',
    setView: vi.fn(),
  };
}

describe('PageContainer', () => {
  it('keeps actions and messages available while preventing controls and content from mounting until ready', () => {
    const controls = makeControls();
    const onAdd = vi.fn();
    const contentMounted = vi.fn();
    function Content() {
      contentMounted();
      return <p>Records</p>;
    }
    const props = {
      controls,
      columns,
      search: { label: 'Search records', placeholder: 'Find records' },
      title: 'Records',
      ariaLabel: 'Record overview',
      actions: <button onClick={onAdd}>Add record</button>,
      messages: ['Reference options unavailable'],
      dashboard: <Content />,
      table: <Content />,
      calendar: <Content />,
      loadingLabel: 'Restoring records…',
    };
    const { rerender } = render(<PageContainer {...props} controls={{ ...controls, ready: false }} />);

    expect(screen.getByRole('status')).toHaveTextContent('Restoring records…');
    expect(screen.getByRole('alert')).toHaveTextContent('Reference options unavailable');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Filters' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /View:/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Columns' })).not.toBeInTheDocument();
    expect(contentMounted).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Add record' }));
    expect(onAdd).toHaveBeenCalledOnce();

    rerender(<PageContainer {...props} controls={controls} />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Search records' })).toHaveValue('draft');
    expect(screen.getByRole('button', { name: 'Filters' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View: Table' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Columns' })).toBeInTheDocument();
    expect(contentMounted).toHaveBeenCalledTimes(2);
  });

  it('connects search changes, application, and clearing once ready', () => {
    const controls = makeControls();
    const { search } = controls;
    render(<PageContainer
      title="Records"
      ariaLabel="Records"
      controls={{ ready: true, search }}
      search={{ label: 'Search records' }}
      table={<p>Records</p>}
    />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Search records' }), { target: { value: 'next' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(search.setValue).toHaveBeenCalledWith('next');
    expect(search.apply).toHaveBeenCalledOnce();
    expect(search.clear).toHaveBeenCalledOnce();
  });

  it('selects the active view and exposes columns only for the table', () => {
    const controls = makeControls();
    function Harness() {
      const [view, setView] = useState<'table' | 'calendar'>('calendar');
      return (
        <PageContainer
          controls={{ ...controls, view, setView }}
          columns={columns}
          search={{ label: 'Search records' }}
          title="Records"
          ariaLabel="Record overview"
          dashboard={<p>Summary</p>}
          table={<p>Table content</p>}
          calendar={<p>Calendar content</p>}
        />
      );
    }
    render(<Harness />);

    expect(screen.getByText('Summary')).toBeInTheDocument();
    expect(screen.getByText('Calendar content')).toBeInTheDocument();
    expect(screen.queryByText('Table content')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Columns' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View: Calendar' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Table' }));

    expect(screen.getByText('Table content')).toBeInTheDocument();
    expect(screen.queryByText('Calendar content')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Columns' }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Status' }));
    expect(controls.table.setHiddenColumns).toHaveBeenCalledWith(['status']);
  });

  it('connects filter application and clearing to the supplied controls', () => {
    const controls = makeControls();
    const { filters } = controls;
    render(<PageContainer title="Records" ariaLabel="Records" controls={{ ready: true, filters }} table={<p>Records</p>} />);

    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Clear all' }));
    expect(filters.clear).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('menuitem', { name: /Status/ }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Active' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Apply' }));
    expect(filters.apply).toHaveBeenCalledWith('statuses', []);
  });
});
