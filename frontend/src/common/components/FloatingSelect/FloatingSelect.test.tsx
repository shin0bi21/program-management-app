import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import FloatingSelect from './FloatingSelect';

const options = [
  { value: 'one', label: 'School One' },
  { value: 'two', label: 'School Two' },
];

describe('FloatingSelect', () => {
  afterEach(() => vi.restoreAllMocks());

  it('filters loaded choices without changing the controlled selection and resets each open session', () => {
    const onChange = vi.fn();
    const { rerender } = render(<FloatingSelect id="school" ariaLabel="School" value="one" options={options} onChange={onChange} search />);
    fireEvent.click(screen.getByRole('button', { name: 'School' }));
    const input = screen.getByRole('combobox', { name: 'Search School' });

    fireEvent.change(input, { target: { value: 'TWO' } });
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('option', { name: 'School Two' }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith('two');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'School' })).toHaveTextContent('School One');

    rerender(<FloatingSelect id="school" ariaLabel="School" value="two" options={options} onChange={onChange} search />);
    fireEvent.click(screen.getByRole('button', { name: 'School' }));
    expect(screen.getByRole('combobox')).toHaveValue('');
    expect(screen.getByRole('option', { name: 'School Two' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it('shows no results and never commits arbitrary text on Enter or Escape', () => {
    const onChange = vi.fn();
    render(<FloatingSelect id="school" value="one" options={options} onChange={onChange} search />);
    fireEvent.click(screen.getByRole('button'));
    const input = screen.getByRole('combobox');

    fireEvent.change(input, { target: { value: 'New school' } });
    expect(screen.getByRole('status')).toHaveTextContent('No matching options.');
    expect(input).not.toHaveAttribute('aria-activedescendant');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('preserves field labels, errors, disabled state, and searchable option actions', () => {
    const onEdit = vi.fn();
    const onAdd = vi.fn();
    const onChange = vi.fn();
    const props = { id: 'school', value: 'one', options, onChange, search: true,
      action: { label: 'Add school', onSelect: onAdd },
      optionActions: (option: typeof options[number]) => [{ label: 'Edit', onSelect: () => onEdit(option.value) }] };
    const { rerender } = render(<><label htmlFor="school">School</label><FloatingSelect {...props} disabled /></>);
    expect(screen.getByLabelText('School')).toBeDisabled();

    rerender(<><label htmlFor="school">School</label><FloatingSelect {...props} aria-invalid aria-describedby="error" />
      <span id="error">Choose a school</span></>);
    fireEvent.click(screen.getByLabelText('School'));
    expect(screen.getByRole('combobox', { name: 'Search School' })).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('combobox')).toHaveAccessibleDescription('Choose a school');
    fireEvent.click(screen.getByRole('button', { name: 'Edit School One' }));
    expect(onEdit).toHaveBeenCalledWith('one');
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('School'));
    fireEvent.click(screen.getByRole('button', { name: 'Add school' }));
    expect(onAdd).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('selects an option and closes the menu', () => {
    const onChange = vi.fn();
    render(<FloatingSelect id="school" value="" options={options} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Select an option' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'School Two' }));

    expect(onChange).toHaveBeenCalledWith('two');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('runs the optional inline action', () => {
    const onSelect = vi.fn();
    render(
      <FloatingSelect
        id="school"
        value=""
        options={options}
        onChange={vi.fn()}
        action={{ label: '+ Add school', onSelect }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Select an option' }));
    const action = screen.getByRole('menuitem', { name: '+ Add school' });
    fireEvent.click(action);
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it('matches the menu width to the trigger width', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 360,
      height: 40,
      top: 20,
      right: 380,
      bottom: 60,
      left: 20,
      x: 20,
      y: 20,
      toJSON: () => ({}),
    } as DOMRect);
    render(<FloatingSelect id="school" value="" options={options} onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Select an option' }));
    expect(screen.getByRole('menu')).toHaveStyle({ width: '360px' });
  });

  it('runs actions attached to an individual option', () => {
    const onEdit = vi.fn();
    render(<FloatingSelect id="school" value="" options={options} onChange={vi.fn()} optionActions={option => [{ label: 'Edit', onSelect: () => onEdit(option.value) }]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Select an option' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit School One' }));

    expect(onEdit).toHaveBeenCalledWith('one');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
