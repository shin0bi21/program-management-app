// Scope: verifies Modal-owned delayed-success closure and timer cleanup.
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Modal from './Modal';

describe('Modal success lifecycle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('closes 1000 ms after success by default', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Modal isOpen onClose={onClose} title="Save" status="submitting">
        Content
      </Modal>,
    );

    act(() => vi.advanceTimersByTime(2000));
    expect(onClose).not.toHaveBeenCalled();

    rerender(
      <Modal isOpen onClose={onClose} title="Save" status="success">
        Content
      </Modal>,
    );
    act(() => vi.advanceTimersByTime(999));
    expect(onClose).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('allows disabling automatic closure with a zero delay', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Saved" status="success" successDelay={0}>
        Content
      </Modal>,
    );

    act(() => vi.runAllTimers());

    expect(onClose).not.toHaveBeenCalled();
  });

  it('starts a fresh success delay on each opening and cancels it while closed', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Modal isOpen={false} onClose={onClose} title="Saved" status="success" successDelay={500}>
        Content
      </Modal>,
    );

    act(() => vi.advanceTimersByTime(1000));
    expect(onClose).not.toHaveBeenCalled();

    rerender(
      <Modal isOpen onClose={onClose} title="Saved" status="success" successDelay={500}>
        Content
      </Modal>,
    );
    act(() => vi.advanceTimersByTime(250));
    expect(onClose).not.toHaveBeenCalled();

    rerender(
      <Modal isOpen={false} onClose={onClose} title="Saved" status="success" successDelay={500}>
        Content
      </Modal>,
    );
    act(() => vi.advanceTimersByTime(1000));
    expect(onClose).not.toHaveBeenCalled();

    rerender(
      <Modal isOpen onClose={onClose} title="Saved" status="success" successDelay={500}>
        Content
      </Modal>,
    );
    act(() => vi.advanceTimersByTime(499));
    expect(onClose).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(onClose).toHaveBeenCalledOnce();

    act(() => vi.advanceTimersByTime(1000));
    expect(onClose).toHaveBeenCalledOnce();
  });

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
    act(() => vi.advanceTimersByTime(499));

    expect(latestClose).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));

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

  it('supports a non-dismissible dialog without losing shared dialog semantics', () => {
    render(
      <Modal isOpen onClose={vi.fn()} title="Session expired" dismissible={false}>
        Sign in again
      </Modal>,
    );

    expect(screen.getByRole('dialog', { name: 'Session expired' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
  });
});
