import tableRefreshMessage from '../Table/tableRefreshMessage';
// Scope: verifies child-owned failures are reported to and cleared from the page owner.
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import usePageMessageReporter from './usePageMessageReporter';

function Reporter({ message, onMessageChange }: {
  message: string | null;
  onMessageChange: ReturnType<typeof vi.fn>;
}) {
  usePageMessageReporter(onMessageChange, message);
  return null;
}

describe('usePageMessageReporter', () => {
  it('reports the current error and clears it when the owner unmounts', () => {
    const onMessageChange = vi.fn();
    const view = render(<Reporter message="Could not load records." onMessageChange={onMessageChange} />);

    expect(onMessageChange).toHaveBeenLastCalledWith({
      message: 'Could not load records.',
      action: undefined,
    });

    view.unmount();
    expect(onMessageChange).toHaveBeenLastCalledWith(null);
  });
});

it('retains failures alongside a refresh warning and updates pending action state', () => {
  const onMessageChange = vi.fn();
  const onRefresh = vi.fn();
  const retry = vi.fn();
  function Messages({ message, refreshing }: { message: string | null; refreshing: boolean }) {
    usePageMessageReporter(onMessageChange, message, { label: 'Retry', onClick: retry }, tableRefreshMessage({ refreshing, onRefresh }));
    return null;
  }
  const view = render(<Messages message="Could not load records." refreshing={false} />);

  expect(onMessageChange).toHaveBeenLastCalledWith([
    { message: 'Could not load records.', action: { label: 'Retry', onClick: retry } },
    expect.objectContaining({ severity: 'warning', action: { label: 'Refresh', onClick: onRefresh, disabled: false } }),
  ]);
  const reports = onMessageChange.mock.calls.length;
  view.rerender(<Messages message="Could not load records." refreshing={false} />);
  expect(onMessageChange).toHaveBeenCalledTimes(reports);

  view.rerender(<Messages message={null} refreshing />);
  expect(onMessageChange).toHaveBeenLastCalledWith(expect.objectContaining({
    severity: 'warning', action: { label: 'Refresh', onClick: onRefresh, disabled: true },
  }));

  view.unmount();
  expect(onMessageChange).toHaveBeenLastCalledWith(null);
});
