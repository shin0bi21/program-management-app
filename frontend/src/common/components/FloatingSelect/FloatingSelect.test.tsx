import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import FloatingSelect from './FloatingSelect';

const options = [
  { value: 'one', label: 'School One' },
  { value: 'two', label: 'School Two' },
];

describe('FloatingSelect', () => {
  afterEach(() => vi.restoreAllMocks());

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
    expect(action.nextElementSibling).toHaveClass('floating-select-options');
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
});
