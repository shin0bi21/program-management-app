import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ViewMenu from './ViewMenu';

describe('ViewMenu', () => {
  it('shows the active view and selects another view', () => {
    const onChange = vi.fn();
    render(
      <ViewMenu
        value="calendar"
        options={[
          { id: 'calendar', label: 'Calendar' },
          { id: 'list', label: 'List' },
        ]}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'View: Calendar' }));
    expect(screen.getByRole('menuitemradio', { name: 'Calendar' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'List' }));
    expect(onChange).toHaveBeenCalledWith('list');
  });
});
