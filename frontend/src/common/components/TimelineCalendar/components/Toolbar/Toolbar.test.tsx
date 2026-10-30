// This suite owns the shared calendar toolbar's navigation controls and live year label.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Toolbar from './Toolbar';

describe('Toolbar', () => {
  it('renders the current year and emits each available navigation action', () => {
    const onPrevious = vi.fn();
    const onNext = vi.fn();
    const onToday = vi.fn();

    render(<Toolbar
      year={2026}
      onPrevious={onPrevious}
      onNext={onNext}
      onToday={onToday}
    />);

    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));

    expect(onPrevious).toHaveBeenCalledOnce();
    expect(onNext).toHaveBeenCalledOnce();
    expect(onToday).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('Calendar year 2026')).toHaveTextContent('2026');
  });
});
