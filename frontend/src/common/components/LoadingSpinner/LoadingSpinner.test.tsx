import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import LoadingSpinner from './LoadingSpinner';

describe('LoadingSpinner', () => {
  it('renders a decorative orange spinner at the requested size', () => {
    const { container } = render(<LoadingSpinner size="lg" className="custom-spinner" />);
    const spinner = container.querySelector('.loading-spinner');

    expect(spinner).toHaveClass('loading-spinner--lg', 'custom-spinner');
    expect(spinner).toHaveAttribute('aria-hidden', 'true');
  });
});
