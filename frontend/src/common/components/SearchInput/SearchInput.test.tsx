import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SearchInput from './SearchInput';

describe('SearchInput', () => {
  it('reports live edits and clearing without submitting a surrounding form', () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn(event => event.preventDefault());
    render(<form onSubmit={onSubmit}>
      <SearchInput label="Search choices" onChange={onChange} />
    </form>);
    const input = screen.getByRole('textbox', { name: 'Search choices' });

    fireEvent.change(input, { target: { value: 'Toronto' } });
    expect(input).toHaveValue('Toronto');
    expect(fireEvent.keyDown(input, { key: 'Enter' })).toBe(false);
    expect(screen.queryByRole('button', { name: 'Search' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(onChange.mock.calls).toEqual([['Toronto'], ['']]);
    expect(input).toHaveValue('');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it.each(['Search', 'Enter'])('submits a trimmed local draft with %s without caller state updates', action => {
    const onApply = vi.fn();
    render(<SearchInput label="Search records" appliedValue="Maya" onApply={onApply} />);
    const input = screen.getByRole('textbox', { name: 'Search records' });

    fireEvent.change(input, { target: { value: '  Alex  ' } });
    expect(input).toHaveValue('  Alex  ');
    expect(onApply).not.toHaveBeenCalled();

    if (action === 'Search') fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    else expect(fireEvent.keyDown(input, { key: 'Enter' })).toBe(false);

    expect(onApply).toHaveBeenCalledExactlyOnceWith('Alex');
    expect(input).toHaveValue('Alex');

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(input).toHaveValue('');
    expect(onApply.mock.calls).toEqual([['Alex'], ['']]);
  });

  it('follows applied changes until the user starts editing', () => {
    const { rerender } = render(<SearchInput label="Search records" appliedValue="Maya" onApply={vi.fn()} />);
    const input = screen.getByRole('textbox', { name: 'Search records' });
    expect(input).toHaveValue('Maya');

    rerender(<SearchInput label="Search records" appliedValue="Alex" onApply={vi.fn()} />);
    expect(input).toHaveValue('Alex');

    fireEvent.change(input, { target: { value: 'unfinished' } });
    rerender(<SearchInput label="Search records" appliedValue="Jamie" onApply={vi.fn()} />);
    expect(input).toHaveValue('unfinished');
  });

  it('allows clearing an applied search with an empty draft and disables Clear only when both are empty', () => {
    const onApply = vi.fn();
    const onChange = vi.fn();
    const props = { label: 'Search records', onApply, onChange };
    const { rerender } = render(<SearchInput {...props} appliedValue="Maya" />);
    const input = screen.getByRole('textbox', { name: 'Search records' });
    const clear = screen.getByRole('button', { name: 'Clear search' });

    fireEvent.change(input, { target: { value: '' } });
    expect(clear).toBeEnabled();
    fireEvent.click(clear);
    expect(onApply).toHaveBeenCalledExactlyOnceWith('');
    expect(onChange).toHaveBeenCalledOnce();
    expect(input).toHaveValue('');
    expect(input).toHaveFocus();

    rerender(<SearchInput {...props} appliedValue="" />);
    expect(clear).toBeDisabled();
    fireEvent.change(input, { target: { value: 'unfinished' } });
    expect(clear).toBeEnabled();
    fireEvent.click(clear);
    expect(onApply.mock.calls).toEqual([[''], ['']]);
    expect(onChange.mock.calls).toEqual([[''], ['unfinished']]);
    expect(input).toHaveValue('');
    expect(clear).toBeDisabled();
  });

  it('contains input keys, allows Escape and Tab to bubble, and honors caller-prevented Enter', () => {
    const onParentKeyDown = vi.fn();
    const onApply = vi.fn();
    render(<div onKeyDown={onParentKeyDown}>
      <SearchInput label="Search choices" onApply={onApply} onKeyDown={event => {
        if (event.key === 'Enter') event.preventDefault();
      }} />
    </div>);
    const input = screen.getByRole('textbox', { name: 'Search choices' });

    for (const key of ['a', 'ArrowDown', 'ArrowUp', 'Home', 'Enter']) {
      fireEvent.keyDown(input, { key });
    }
    expect(onParentKeyDown).not.toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();

    expect(fireEvent.keyDown(input, { key: 'Escape' })).toBe(true);
    expect(fireEvent.keyDown(input, { key: 'Tab' })).toBe(true);
    expect(onParentKeyDown.mock.calls.map(([event]) => event.key)).toEqual(['Escape', 'Tab']);
  });

  it('disables the input and both actions together', () => {
    render(<SearchInput label="Search tasks" appliedValue="planning" onApply={vi.fn()} disabled />);

    expect(screen.getByRole('textbox', { name: 'Search tasks' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Clear search' })).toBeDisabled();
  });
});
