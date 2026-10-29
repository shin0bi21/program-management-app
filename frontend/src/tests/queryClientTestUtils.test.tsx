import { render, screen } from '@testing-library/react';
import { useQueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import {
  createQueryClientWrapper,
  createTestQueryClient,
  renderWithQueryClient,
} from './queryClientTestUtils';

describe('queryClientTestUtils', () => {
  it('creates isolated clients with retries disabled', () => {
    const firstClient = createTestQueryClient();
    const secondClient = createTestQueryClient();

    expect(firstClient).not.toBe(secondClient);
    expect(firstClient.getDefaultOptions()).toEqual(expect.objectContaining({
      queries: expect.objectContaining({ retry: false }),
      mutations: expect.objectContaining({ retry: false }),
    }));
  });

  it('returns the client that provides the rendered component', () => {
    let providedClient: ReturnType<typeof createTestQueryClient> | undefined;
    function ClientProbe() {
      providedClient = useQueryClient();
      return <span>Query-backed content</span>;
    }
    const { queryClient } = renderWithQueryClient(<ClientProbe />);

    expect(screen.getByText('Query-backed content')).toBeInTheDocument();
    expect(providedClient).toBe(queryClient);
  });

  it('creates a reusable hook wrapper for a supplied client', () => {
    const queryClient = createTestQueryClient();
    const Wrapper = createQueryClientWrapper(queryClient);
    function ClientProbe() {
      return <span>{useQueryClient() === queryClient ? 'Supplied client' : 'Wrong client'}</span>;
    }

    render(<Wrapper><ClientProbe /></Wrapper>);

    expect(screen.getByText('Supplied client')).toBeInTheDocument();
  });
});
