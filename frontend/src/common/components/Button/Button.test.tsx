import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import Button from './Button';

describe('Button', () => {
  it('defaults to a non-submit button and forwards native behavior', () => {
    const onClick = vi.fn();
    const ref = createRef<HTMLButtonElement>();

    render(<Button ref={ref} aria-label="Save changes" onClick={onClick}>Save</Button>);

    const button = screen.getByRole('button', { name: 'Save changes' });
    expect(button).toHaveAttribute('type', 'button');
    expect(ref.current).toBe(button);

    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
