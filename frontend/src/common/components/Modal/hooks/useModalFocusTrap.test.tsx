import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import useModalFocusTrap from './useModalFocusTrap';

function FocusTrapHarness({ disableClose = false, onClose = vi.fn() }) {
  const ref = useModalFocusTrap({ isOpen: true, disableClose, onClose });

  return <div ref={ref} role="dialog" tabIndex={-1}>
    <button>First</button>
    <button>Last</button>
  </div>;
}

describe('useModalFocusTrap', () => {
  it('places focus, wraps Tab navigation, and restores the previous target', () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();

    const { unmount } = render(<FocusTrapHarness />);
    const first = screen.getByRole('button', { name: 'First' });
    const last = screen.getByRole('button', { name: 'Last' });

    expect(first).toHaveFocus();
    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(first).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();

    unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });

  it('dismisses only when closing is enabled', () => {
    const onClose = vi.fn();
    const { rerender } = render(<FocusTrapHarness onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();

    rerender(<FocusTrapHarness disableClose onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
