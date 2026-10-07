import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPublicHomepageSignup } from '../publicHomepage.api';
import { useHomepageSignup } from './useHomepageSignup';

vi.mock('../publicHomepage.api', () => ({ getPublicHomepageSignup: vi.fn() }));
const createWrapper = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
};

describe('useHomepageSignup', () => {
  beforeEach(() => vi.clearAllMocks());

  it('forwards cancellation to the independent signup request', async () => {
    vi.mocked(getPublicHomepageSignup).mockResolvedValue({ signupEnabled: true });
    const { result } = renderHook(useHomepageSignup, { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.signupEnabled).toBe(true));
    expect(getPublicHomepageSignup).toHaveBeenCalledWith({ signal: expect.any(AbortSignal) });
  });

  it('keeps signup hidden on a failed read and exposes its own retry', async () => {
    vi.mocked(getPublicHomepageSignup).mockRejectedValueOnce(new Error('Signup unavailable'));
    const { result } = renderHook(useHomepageSignup, { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.error).toBe('Signup unavailable'));
    expect(result.current.signupEnabled).toBe(false);

    vi.mocked(getPublicHomepageSignup).mockResolvedValue({ signupEnabled: true });
    await act(() => result.current.refresh());
    await waitFor(() => expect(result.current.signupEnabled).toBe(true));
    expect(result.current.error).toBeNull();
  });
});
