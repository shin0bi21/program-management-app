import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ErrorBoundary from './ErrorBoundary';

function BrokenComponent(): never {
  throw new Error('Render failed');
}

describe('ErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('replaces a failed component tree with a reload fallback', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <p>Application content</p>
        <BrokenComponent />
      </ErrorBoundary>,
    );

    expect(screen.queryByText('Application content')).not.toBeInTheDocument();
    const fallback = screen.getByRole('main', { name: 'Something went wrong' });

    expect(fallback).toHaveFocus();
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
    expect(screen.getByText('An unexpected error occurred. Please reload the page.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument();
  });
});
