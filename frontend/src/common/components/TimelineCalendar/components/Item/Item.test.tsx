import { makeItemCalendarProps } from '../../../../../tests/factories/calendarItem';
import { useState } from 'react';
// Scope: verifies shared calendar-item actions, detail discovery, and hover dismissal.
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Item from './Item';

const target = { row: { id: 'row-1' }, data: { id: 'item-1' }, range: { start: '2026-08-19', end: '2026-08-20' } };

const itemProps = {
  id: 'item-1',
  ariaLabel: 'Prepare workshop',
  summary: 'Prepare workshop',
  detailTitle: 'Prepare workshop details',
  details: [{ label: 'Program', value: 'After School' }],
};

describe('Item', () => {
  it('selects its row before activating the item', () => {
    const calls: string[] = [];
    const calendar = makeItemCalendarProps(target, {
      onSelect: () => calls.push('select'),
      onActivate: () => calls.push('activate'),
    });
    render(<Item {...itemProps} calendar={calendar} />);
    const trigger = screen.getByRole('button', { name: 'Prepare workshop' });

    fireEvent.click(trigger);

    expect(calls).toEqual(['select', 'activate']);
  });

  it('reads click suppression at event time before selection, activation, or opening menus', () => {
    let suppressed = true;
    const onSelect = vi.fn();
    const onActivate = vi.fn();
    const calendar = makeItemCalendarProps(target, {
      environment: { ...makeItemCalendarProps(target).environment, isClickSuppressed: () => suppressed }, onSelect, onActivate,
    });
    render(<Item {...itemProps} calendar={calendar} onEdit={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: /Prepare workshop.*Open actions/ });

    fireEvent.click(trigger);
    expect(onSelect).not.toHaveBeenCalled();
    expect(onActivate).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    suppressed = false;
    fireEvent.click(trigger);
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onActivate).toHaveBeenCalledOnce();
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('selects the row without activating the item when clicking a resize handle', () => {
    const onSelect = vi.fn();
    const onActivate = vi.fn();
    const calendar = makeItemCalendarProps(target, { resizable: true, onSelect, onActivate });
    render(<Item {...itemProps} calendar={calendar} />);

    fireEvent.click(screen.getByRole('button', { name: 'Resize start of item-1' }));

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('anchors the menu after the opening click changes the parent layout', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.matches('.calendar-item')) {
        const expanded = this.closest('[data-expanded]')?.getAttribute('data-expanded') === 'true';
        return new DOMRect(20, expanded ? 180 : 40, 120, 32);
      }
      return new DOMRect(0, 0, 150, 86);
    });
    function SelectableItem() {
      const [selected, setSelected] = useState(false);
      return <div data-expanded={String(selected)} onClick={() => setSelected(true)}>
        <Item {...itemProps} onEdit={vi.fn()} />
      </div>;
    }
    render(<SelectableItem />);

    fireEvent.click(screen.getByRole('button', { name: /Prepare workshop.*Open actions/ }));
    expect(screen.getByRole('menu')).toHaveStyle({ top: '216px' });
  });


  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('opens item details from the action menu for touch-accessible discovery', () => {
    render(<Item
      id="task-1"
      ariaLabel="Prepare workshop"
      summary="Prepare workshop"
      detailTitle="Prepare workshop details"
      details={[{ label: 'Program', value: 'After School' }]}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
    />);

    fireEvent.click(screen.getByRole('button', { name: /Prepare workshop.*Open actions/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'View details' }));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('tooltip', { name: /Prepare workshop details/ })).toHaveTextContent('After School');
  });

  it('omits the touch details action when precise hover is available', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    render(<Item
      id="task-1"
      ariaLabel="Prepare workshop"
      summary="Prepare workshop"
      detailTitle="Prepare workshop details"
      details={[]}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
    />);

    fireEvent.click(screen.getByRole('button', { name: /Prepare workshop.*Open actions/ }));

    expect(screen.queryByRole('menuitem', { name: 'View details' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toHaveFocus();
  });

  it('offers edit when delete is unavailable', () => {
    const onEdit = vi.fn();
    render(<Item
      {...itemProps}
      onEdit={onEdit}
    />);

    fireEvent.click(screen.getByRole('button', { name: /Prepare workshop.*Open actions/ }));

    expect(screen.queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it('dismisses hover details immediately on pointer down', async () => {
    render(<Item {...itemProps} />);
    const trigger = screen.getByRole('button', { name: 'Prepare workshop' });
    fireEvent.mouseEnter(trigger);
    expect(await screen.findByRole('tooltip')).toBeInTheDocument();

    fireEvent.pointerDown(trigger);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
