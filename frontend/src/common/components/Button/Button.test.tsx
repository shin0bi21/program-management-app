// Owns the shared button's native attributes, styling variants, and ref contract.
import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import Button from './Button';

describe('Button', () => {
  it('defaults to a primary non-submit button and forwards native behavior', () => {
    const onClick = vi.fn();
    const ref = createRef<HTMLButtonElement>();

    render(<Button ref={ref} aria-label="Save changes" onClick={onClick}>Save</Button>);

    const button = screen.getByRole('button', { name: 'Save changes' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveClass('btn');
    expect(button).not.toHaveClass('btn--secondary', 'btn--full', 'btn--sm');
    expect(ref.current).toBe(button);

    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('composes variant, width, size, and caller classes while preserving submit type', () => {
    render(
      <Button type="submit" variant="danger" fullWidth size="sm" className="save-button">
        Delete
      </Button>,
    );

    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass(
      'btn',
      'btn--danger',
      'btn--full',
      'btn--sm',
      'save-button',
    );
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveAttribute('type', 'submit');
  });
});
