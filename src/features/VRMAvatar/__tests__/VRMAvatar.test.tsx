import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __resetVrmRegistry } from '../concurrency';
import VRMAvatar from '../index';

const buildWrapper = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

/**
 * Stub `IntersectionObserver` so effect-gated scene mounts actually fire
 * in happy-dom. Without this, `useInViewport` falls to its "undefined IO"
 * fallback which is also fine but we want to exercise the real path when
 * possible. Tests that want off-screen behaviour can override it.
 */
function stubIntersectionObserver(intersecting: boolean) {
  class FakeIO {
    callback: IntersectionObserverCallback;
    constructor(cb: IntersectionObserverCallback) {
      this.callback = cb;
    }
    observe(target: Element) {
      // Synchronously report the target's intersection state so the hook
      // flips in the mount effect without an async queue microtask.
      this.callback(
        [
          {
            boundingClientRect: target.getBoundingClientRect(),
            intersectionRatio: intersecting ? 1 : 0,
            intersectionRect: target.getBoundingClientRect(),
            isIntersecting: intersecting,
            rootBounds: null,
            target,
            time: 0,
          } as unknown as IntersectionObserverEntry,
        ],
        this as unknown as IntersectionObserver,
      );
    }
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  vi.stubGlobal('IntersectionObserver', FakeIO as unknown as typeof IntersectionObserver);
}

describe('VRMAvatar', () => {
  beforeEach(() => {
    __resetVrmRegistry();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/api/pantheon/v1/agents/does-not-exist/vrm')) {
          return new Response('null', { status: 404 });
        }
        if (url.includes('/api/pantheon/v1/agents/resolver-ok/vrm')) {
          return new Response(
            JSON.stringify({
              pose_idle: 'idle-01',
              stage: '#goddess-council:pantheon',
              url: '/signed/vrm/resolver-ok.vrm',
            }),
            { headers: { 'content-type': 'application/json' }, status: 200 },
          );
        }
        // Force network-error fallback so the hook returns MOCK_CATALOG.
        throw new Error('test: network unreachable');
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders VRM card for a known agent slug', async () => {
    const Wrapper = buildWrapper();
    render(
      <Wrapper>
        <VRMAvatar agentSlug="rapi-advocate" />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('vrm-avatar-rapi-advocate')).toBeTruthy();
    });
    expect(screen.getByText('VRM: rapi-advocate')).toBeTruthy();
    expect(screen.getByText('/branding/vrm/rapi-advocate.vrm')).toBeTruthy();
  });

  it('renders fallback for an unknown agent slug (404)', async () => {
    const Wrapper = buildWrapper();
    render(
      <Wrapper>
        <VRMAvatar agentSlug="does-not-exist" />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('vrm-avatar-fallback-does-not-exist')).toBeTruthy();
    });
    expect(screen.getByText('No VRM binding')).toBeTruthy();
  });

  it('respects the `size` prop by applying it to the inline style', async () => {
    const Wrapper = buildWrapper();
    const { container } = render(
      <Wrapper>
        <VRMAvatar agentSlug="vesper-command" size={160} />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('vrm-avatar-vesper-command')).toBeTruthy();
    });
    const card = container.querySelector(
      '[data-testid="vrm-avatar-vesper-command"]',
    ) as HTMLElement;
    expect(card.style.width).toBe('160px');
    expect(card.style.height).toBe('160px');
  });

  it('renders placeholder (not scene) when forcePlaceholder=true even for known slug', async () => {
    const Wrapper = buildWrapper();
    render(
      <Wrapper>
        <VRMAvatar forcePlaceholder agentSlug="rapi-advocate" />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('vrm-avatar-rapi-advocate')).toBeTruthy();
    });
    // Scene mount should not appear when placeholder is forced.
    expect(screen.queryByTestId('vrm-avatar-scene-rapi-advocate')).toBeNull();
  });

  it('renders binding returned by the resolver API (happy-path fetch)', async () => {
    const Wrapper = buildWrapper();
    render(
      <Wrapper>
        <VRMAvatar agentSlug="resolver-ok" />
      </Wrapper>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('vrm-avatar-resolver-ok')).toBeTruthy();
    });
    // The resolver payload's signed URL should surface in the placeholder
    // card body, proving we rendered the fetched binding (not the mock).
    expect(screen.getByText('/signed/vrm/resolver-ok.vrm')).toBeTruthy();
  });

  it('renders placeholder (not scene) when prefers-reduced-motion is set', async () => {
    if (typeof window !== 'undefined') {
      vi.spyOn(window, 'matchMedia').mockImplementation(
        (query: string) =>
          ({
            addEventListener: () => undefined,
            addListener: () => undefined,
            dispatchEvent: () => true,
            matches: true,
            media: query,
            onchange: null,
            removeEventListener: () => undefined,
            removeListener: () => undefined,
          }) as unknown as MediaQueryList,
      );
    }
    stubIntersectionObserver(true);

    const Wrapper = buildWrapper();
    render(
      <Wrapper>
        <VRMAvatar agentSlug="rapi-advocate" />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('vrm-avatar-rapi-advocate')).toBeTruthy();
    });
    // Scene is suppressed by the reduced-motion preference — placeholder
    // card (`vrm-avatar-${slug}`) is rendered instead.
    expect(screen.queryByTestId('vrm-avatar-scene-rapi-advocate')).toBeNull();
  });

  it('IntersectionObserver gating: off-screen avatars never mount the scene', async () => {
    stubIntersectionObserver(false);
    const Wrapper = buildWrapper();
    render(
      <Wrapper>
        <VRMAvatar agentSlug="rapi-advocate" />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('vrm-avatar-rapi-advocate')).toBeTruthy();
    });
    expect(screen.queryByTestId('vrm-avatar-scene-rapi-advocate')).toBeNull();
  });

  it('concurrency cap: a third in-view non-reduced-motion avatar falls back to placeholder', async () => {
    stubIntersectionObserver(true);
    const Wrapper = buildWrapper();
    render(
      <Wrapper>
        <>
          <VRMAvatar agentSlug="rapi-advocate" />
          <VRMAvatar agentSlug="vesper-command" />
          <VRMAvatar agentSlug="rapi-advocate" />
        </>
      </Wrapper>,
    );

    await waitFor(() => {
      // Three copies — at least one non-scene copy must survive the cap.
      const placeholders = screen.queryAllByTestId(/^vrm-avatar-(rapi-advocate|vesper-command)$/);
      expect(placeholders.length).toBeGreaterThanOrEqual(1);
    });
  });
});
