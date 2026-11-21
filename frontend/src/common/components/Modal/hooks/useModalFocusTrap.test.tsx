import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import useModalFocusTrap from './useModalFocusTrap';

function FocusTrapHarness() {
  const ref = useModalFocusTrap({ isOpen: true });

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
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(first).toHaveFocus();
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();

    unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });
});
