// Scope: verifies child-owned failures are reported to and cleared from the page owner.
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import usePageErrorReporter from './usePageErrorReporter';

function Reporter({ message, onErrorChange }: {
  message: string | null;
  onErrorChange: ReturnType<typeof vi.fn>;
}) {
  usePageErrorReporter(onErrorChange, message);
  return null;
}

describe('usePageErrorReporter', () => {
  it('reports the current error and clears it when the owner unmounts', () => {
    const onErrorChange = vi.fn();
    const view = render(<Reporter message="Could not load records." onErrorChange={onErrorChange} />);

    expect(onErrorChange).toHaveBeenLastCalledWith({
      message: 'Could not load records.',
      action: undefined,
    });

    view.unmount();
    expect(onErrorChange).toHaveBeenLastCalledWith(null);
  });
});
