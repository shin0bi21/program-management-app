// Scope: verifies Modal-owned delayed-success closure and timer cleanup.
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Modal from './Modal';

describe('Modal success lifecycle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('closes once through the latest callback after the success delay', () => {
    const firstClose = vi.fn();
    const latestClose = vi.fn();
    const { rerender } = render(
      <Modal isOpen onClose={firstClose} title="Saved" status="success" successDelay={500}>
        Content
      </Modal>,
    );

    rerender(
      <Modal isOpen onClose={latestClose} title="Saved" status="success" successDelay={500}>
        Content
      </Modal>,
    );
    act(() => vi.advanceTimersByTime(500));

    expect(firstClose).not.toHaveBeenCalled();
    expect(latestClose).toHaveBeenCalledOnce();
  });

  it('cancels delayed closure when success ends or the modal unmounts', () => {
    const onClose = vi.fn();
    const { rerender, unmount } = render(
      <Modal isOpen onClose={onClose} title="Saved" status="success" successDelay={500}>
        Content
      </Modal>,
    );

    rerender(
      <Modal isOpen onClose={onClose} title="Saved" status="idle" successDelay={500}>
        Content
      </Modal>,
    );
    act(() => vi.advanceTimersByTime(500));
    expect(onClose).not.toHaveBeenCalled();

    rerender(
      <Modal isOpen onClose={onClose} title="Saved" status="success" successDelay={500}>
        Content
      </Modal>,
    );
    unmount();
    act(() => vi.runAllTimers());
    expect(onClose).not.toHaveBeenCalled();
  });
});
