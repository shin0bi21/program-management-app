import { describe, expect, it, vi } from 'vitest';
import { createReAuthCoordinator } from './reAuthCoordinator';

describe('reAuthCoordinator', () => {
  it('opens one prompting workflow and returns a stable snapshot', () => {
    const coordinator = createReAuthCoordinator();
    const listener = vi.fn();
    coordinator.subscribe(listener);

    const idleSnapshot = coordinator.getSnapshot();
    expect(coordinator.getSnapshot()).toBe(idleSnapshot);

    void coordinator.requestReAuth();

    expect(coordinator.getSnapshot()).toEqual({ status: 'prompting' });
    expect(coordinator.getSnapshot()).toBe(coordinator.getSnapshot());
    expect(listener).toHaveBeenCalledOnce();
    coordinator.resolveReAuth();
  });

  it('shares one pending promise between concurrent callers', () => {
    const coordinator = createReAuthCoordinator();

    const first = coordinator.requestReAuth();
    const second = coordinator.requestReAuth();

    expect(second).toBe(first);
    coordinator.resolveReAuth();
  });

  it('resolves all waiters and returns to idle', async () => {
    const coordinator = createReAuthCoordinator();
    const first = coordinator.requestReAuth();
    const second = coordinator.requestReAuth();

    coordinator.resolveReAuth();

    await expect(first).resolves.toBeUndefined();
    await expect(second).resolves.toBeUndefined();
    expect(coordinator.getSnapshot()).toEqual({ status: 'idle' });
  });

  it('rejects all waiters with the supplied error and returns to idle', async () => {
    const coordinator = createReAuthCoordinator();
    const error = new Error('Session ended');
    const first = coordinator.requestReAuth();
    const second = coordinator.requestReAuth();

    coordinator.rejectReAuth(error);

    await expect(first).rejects.toBe(error);
    await expect(second).rejects.toBe(error);
    expect(coordinator.getSnapshot()).toEqual({ status: 'idle' });
  });
});
// @vitest-environment node
