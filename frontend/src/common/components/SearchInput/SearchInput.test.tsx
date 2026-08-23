// Scope: verifies shared draft search application, keyboard submission, and clearing.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SearchInput from './SearchInput';

describe('SearchInput', () => {
  it('applies with the Search button or Enter and exposes Clear', () => {
    const onApply = vi.fn();
    const onClear = vi.fn();
    render(<SearchInput
      label="Search tasks"
      value="planning"
      appliedValue="workshop"
      onChange={() => undefined}
      onApply={onApply}
      onClear={onClear}
    />);

    const input = screen.getByRole('textbox', { name: 'Search tasks' });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(onApply).toHaveBeenCalledTimes(1);

    expect(fireEvent.keyDown(input, { key: 'Enter' })).toBe(false);
    expect(onApply).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it('disables Clear when neither draft nor applied search has a value', () => {
    render(<SearchInput
      label="Search tasks"
      value=""
      appliedValue=""
      onChange={() => undefined}
      onApply={() => undefined}
      onClear={() => undefined}
    />);

    expect(screen.getByRole('button', { name: 'Clear search' })).toBeDisabled();
  });

  it('disables the input and both actions together', () => {
    render(<SearchInput
      label="Search tasks"
      value="planning"
      appliedValue="planning"
      onChange={() => undefined}
      onApply={() => undefined}
      onClear={() => undefined}
      disabled
    />);

    expect(screen.getByRole('textbox', { name: 'Search tasks' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Clear search' })).toBeDisabled();
  });
});
