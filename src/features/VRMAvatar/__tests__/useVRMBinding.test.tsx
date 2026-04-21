import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useVRMBinding } from '../hooks/useVRMBinding';

const buildWrapper = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

describe('useVRMBinding', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the resolver payload on happy-path', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              pose_idle: 'idle-07',
              stage: '#heretic-forge:pantheon',
              url: '/signed/url/foo.vrm',
            }),
            { headers: { 'content-type': 'application/json' }, status: 200 },
          ),
      ),
    );

    const { result } = renderHook(() => useVRMBinding('zenith-strategy'), {
      wrapper: buildWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      poseIdle: 'idle-07',
      stage: '#heretic-forge:pantheon',
      url: '/signed/url/foo.vrm',
    });
  });

  it('returns null on 404 (agent has no vrm)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 404 })),
    );

    const { result } = renderHook(() => useVRMBinding('loen-ethics'), {
      wrapper: buildWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it('falls back to mock catalog on network error for a known seed slug', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('boom');
      }),
    );

    const { result } = renderHook(() => useVRMBinding('rapi-advocate'), {
      wrapper: buildWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({
      url: '/branding/vrm/rapi-advocate.vrm',
    });
  });

  it('is disabled for empty agent slug', () => {
    const { result } = renderHook(() => useVRMBinding(''), {
      wrapper: buildWrapper(),
    });
    expect(result.current.fetchStatus).toBe('idle');
  });
});
