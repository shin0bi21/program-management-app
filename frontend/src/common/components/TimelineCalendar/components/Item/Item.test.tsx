// Scope: verifies shared calendar-item actions, detail discovery, and hover dismissal.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Item from './Item';

const itemProps = {
  id: 'item-1',
  ariaLabel: 'Prepare workshop',
  summary: 'Prepare workshop',
  detailTitle: 'Prepare workshop details',
  details: [{ label: 'Program', value: 'After School' }],
};

describe('Item', () => {
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

    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    expect(onEdit).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('dismisses hover details immediately on pointer down', async () => {
    render(<Item {...itemProps} />);
    const trigger = screen.getByRole('button', { name: 'Prepare workshop' });
    fireEvent.mouseEnter(trigger);
    expect(await screen.findByRole('tooltip')).toBeInTheDocument();

    fireEvent.pointerDown(trigger);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('does not open hover details when the pointer leaves during the delay', () => {
    vi.useFakeTimers();
    try {
      render(<Item {...itemProps} />);
      const trigger = screen.getByRole('button', { name: 'Prepare workshop' });
      fireEvent.mouseEnter(trigger);
      fireEvent.mouseLeave(trigger);
      act(() => vi.advanceTimersByTime(120));

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
