import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SearchInput from './SearchInput';

describe('SearchInput', () => {
  it('supports search without an apply action, forwards navigation, and restores focus after clearing', () => {
    const onClear = vi.fn();
    const onKeyDown = vi.fn(event => event.preventDefault());
    render(<SearchInput label="Search choices" value="Toronto" onChange={() => undefined}
      onClear={onClear} onKeyDown={onKeyDown} />);

    const input = screen.getByRole('textbox', { name: 'Search choices' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(onKeyDown).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Search' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(onClear).toHaveBeenCalledOnce();
    expect(input).toHaveFocus();
  });

  it('applies with Search or Enter and exposes Clear', () => {
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
    const searchButton = screen.getByRole('button', { name: 'Search' });
    const clearButton = screen.getByRole('button', { name: 'Clear search' });

    fireEvent.click(searchButton);
    expect(onApply).toHaveBeenCalledTimes(1);

    expect(fireEvent.keyDown(input, { key: 'Enter' })).toBe(false);
    expect(onApply).toHaveBeenCalledTimes(2);

    fireEvent.click(clearButton);
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
