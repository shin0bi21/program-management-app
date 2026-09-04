import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import FloatingMenuPanel from './FloatingMenuPanel';

function renderPanel(onClose = vi.fn()) {
  const menuRef = createRef<HTMLDivElement>();
  const onPointerDown = vi.fn();
  render(
    <div onPointerDown={onPointerDown}>
      <FloatingMenuPanel
        menuRef={menuRef}
        position={{ top: 24, left: 48 }}
        onClose={onClose}
        className="actions-menu"
        width={220}
      >
        <button type="button" role="menuitem">First</button>
        <button type="button" role="menuitem">Second</button>
        <button type="button" role="menuitem">Third</button>
      </FloatingMenuPanel>
    </div>,
  );
  return { menuRef, onClose, onPointerDown };
}

describe('FloatingMenuPanel', () => {
  it('portals the positioned menu to the document body and contains pointer events', () => {
    const { menuRef, onPointerDown } = renderPanel();

    const menu = screen.getByRole('menu');
    expect(menu.parentElement).toBe(document.body);
    expect(menu).toHaveClass('floating-menu-panel', 'actions-menu');
    expect(menu).toHaveStyle({ top: '24px', left: '48px', width: '220px' });
    expect(menuRef.current).toBe(menu);

    fireEvent.pointerDown(menu);
    expect(onPointerDown).not.toHaveBeenCalled();
  });

  it('cycles menu-item focus with arrow, Home, and End keys', () => {
    renderPanel();
    const items = screen.getAllByRole('menuitem');

    items[0].focus();
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    expect(items[1]).toHaveFocus();
    fireEvent.keyDown(document, { key: 'End' });
    expect(items[2]).toHaveFocus();
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    expect(items[0]).toHaveFocus();
    fireEvent.keyDown(document, { key: 'ArrowUp' });
    expect(items[2]).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Home' });
    expect(items[0]).toHaveFocus();
  });

  it.each(['Escape', 'Tab'])('requests dismissal when %s is pressed', (key) => {
    const onClose = vi.fn();
    renderPanel(onClose);

    fireEvent.keyDown(document, { key });

    expect(onClose).toHaveBeenCalledOnce();
  });
});
