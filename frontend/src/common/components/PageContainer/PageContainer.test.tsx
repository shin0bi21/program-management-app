import { StrictMode, useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TableColumnDef } from '../Table/Table.types';
import PageContainer from './PageContainer';
import usePageMessageReporter from '../PageMessageOverlay/usePageMessageReporter';
import type { PageMessageItem } from '../PageMessageOverlay/PageMessageOverlay';

const columns: TableColumnDef<{ name: string; status: string }>[] = [
  { id: 'name', header: 'Name', accessorKey: 'name' },
  { id: 'status', header: 'Status', accessorKey: 'status' },
];

/**
 * Supplies ready collection controls with observable action callbacks.
 * @returns Fresh controls so each test owns its action history.
 * @example makeControls().search.appliedValue // 'saved'
 */
function makeControls() {
  return {
    search: {
      appliedValue: 'saved',
      apply: vi.fn(),
    },
    filters: {
      definitions: [{ id: 'statuses', label: 'Status', options: [{ id: 'active', name: 'Active' }] }],
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
    expect(screen.getByRole('textbox', { name: 'Search records' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filters' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View: Table' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Columns' })).toBeInTheDocument();
    expect(contentMounted).toHaveBeenCalledTimes(2);
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

/**
 * Reports nested child feedback without route-owned callback wiring.
 * @param props - Current failure, recovery action, and optional additional notice.
 * @example <MessageReporter message="Notes unavailable" />
 */
function MessageReporter({ message, action, notice }: {
  message: string | null;
  action?: PageMessageItem['action'];
  notice?: PageMessageItem;
}) {
  usePageMessageReporter(undefined, message, action, notice);
  return null;
}

describe('PageContainer child messages', () => {
  it('combines nested dashboard and body messages with page messages and clears only the departing source', () => {
    function Page({ first, showSecond }: { first: string | null; showSecond: boolean }) {
      return <PageContainer
        title="Records"
        ariaLabel="Records"
        messages={['Reference options unavailable']}
        dashboard={<section><MessageReporter message={first} /></section>}
        table={showSecond ? <MessageReporter message="Records unavailable" /> : null}
      />;
    }
    const view = render(<StrictMode><Page first="Notes unavailable" showSecond /></StrictMode>);

    expect(screen.getByRole('alert')).toHaveTextContent('Reference options unavailable');
    expect(screen.getByRole('alert')).toHaveTextContent('Notes unavailable');
    expect(screen.getByRole('alert')).toHaveTextContent('Records unavailable');

    view.rerender(<StrictMode><Page first="Attendance unavailable" showSecond /></StrictMode>);
    expect(screen.getByRole('alert')).not.toHaveTextContent('Notes unavailable');
    expect(screen.getByRole('alert')).toHaveTextContent('Attendance unavailable');
    expect(screen.getByRole('alert')).toHaveTextContent('Records unavailable');

    view.rerender(<StrictMode><Page first={null} showSecond /></StrictMode>);
    expect(screen.getByRole('alert')).not.toHaveTextContent('Attendance unavailable');
    expect(screen.getByRole('alert')).toHaveTextContent('Records unavailable');

    view.rerender(<StrictMode><Page first={null} showSecond={false} /></StrictMode>);
    expect(screen.getByRole('alert')).toHaveTextContent('Reference options unavailable');
    expect(screen.getByRole('alert')).not.toHaveTextContent('Records unavailable');
  });

  it('preserves warnings, details, recovery actions, and pending changes through the overlay', () => {
    const retry = vi.fn();
    function Page({ error, pending }: { error: string | null; pending: boolean }) {
      return <PageContainer title="Records" ariaLabel="Records" table={null} dashboard={<MessageReporter
        message={error}
        action={{ label: 'Retry', onClick: retry, disabled: pending }}
        notice={{ message: 'Order changed', severity: 'warning', details: 'Refresh to reorder records.' }}
      />} />;
    }
    const view = render(<Page error="Notes unavailable" pending={false} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Refresh to reorder records.');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalledOnce();

    view.rerender(<Page error="Notes unavailable" pending />);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeDisabled();

    view.rerender(<Page error={null} pending={false} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Order changed');
  });

  it('keeps dismissal across unchanged reports and shows a failure again after it clears', () => {
    function Page({ message }: { message: string | null }) {
      return <PageContainer title="Records" ariaLabel="Records" table={null} dashboard={<MessageReporter message={message} />} />;
    }
    const view = render(<Page message="Notes unavailable" />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss page messages' }));

    view.rerender(<Page message="Notes unavailable" />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    view.rerender(<Page message={null} />);
    view.rerender(<Page message="Notes unavailable" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Notes unavailable');
  });

  it('clears dashboard and active-view reports when saved controls become unready', () => {
    function Page({ ready, view }: { ready: boolean; view: 'table' | 'calendar' }) {
      return <PageContainer
        title="Records"
        ariaLabel="Records"
        controls={{ ready, view, setView: vi.fn() }}
        messages={['Page error']}
        dashboard={<MessageReporter message="Dashboard error" />}
        table={<MessageReporter message="Table error" />}
        calendar={<MessageReporter message="Calendar error" />}
      />;
    }
    const view = render(<Page ready view="table" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Table error');

    view.rerender(<Page ready view="calendar" />);
    expect(screen.getByRole('alert')).not.toHaveTextContent('Table error');
    expect(screen.getByRole('alert')).toHaveTextContent('Calendar error');
    expect(screen.getByRole('alert')).toHaveTextContent('Dashboard error');

    view.rerender(<Page ready={false} view="calendar" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Page error');
    expect(screen.getByRole('alert')).not.toHaveTextContent('Calendar error');
    expect(screen.getByRole('alert')).not.toHaveTextContent('Dashboard error');
  });

  it('isolates nested pages and gives explicit callbacks sole ownership of their reports', () => {
    const onMessageChange = vi.fn();
    function CallbackReporter() {
      usePageMessageReporter(onMessageChange, 'Callback-owned error');
      return null;
    }
    render(<PageContainer
      title="Outer"
      ariaLabel="Outer"
      dashboard={<><MessageReporter message="Outer error" /><CallbackReporter /></>}
      table={<PageContainer title="Inner" ariaLabel="Inner" table={<MessageReporter message="Inner error" />} />}
    />);

    const outer = screen.getByRole('main', { name: 'Outer' });
    const inner = screen.getByRole('main', { name: 'Inner' });
    expect(within(inner).getByRole('alert')).toHaveTextContent('Inner error');
    expect(within(inner).getByRole('alert')).not.toHaveTextContent('Outer error');
    const outerAlert = within(outer).getAllByRole('alert').find(alert => !inner.contains(alert));
    expect(outerAlert).toHaveTextContent('Outer error');
    expect(outerAlert).not.toHaveTextContent('Inner error');
    expect(screen.queryByText('Callback-owned error')).not.toBeInTheDocument();
    expect(onMessageChange).toHaveBeenLastCalledWith(expect.objectContaining({ message: 'Callback-owned error' }));
  });
});
