import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import VRMAvatar from '../index';

const buildWrapper = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

describe('VRMAvatar', () => {
  beforeEach(() => {
    // Force the resolver fetch to 404 so we fall through to the MOCK_CATALOG
    // branch in the hook (which seeds rapi-advocate and vesper-command).
    // An "unknown" slug with 404 yields `null` binding → fallback card.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/api/pantheon/v1/agents/does-not-exist/vrm')) {
          return new Response('null', { status: 404 });
        }
        // Force network-error fallback so the hook returns MOCK_CATALOG.
        throw new Error('test: network unreachable');
      }),
    );
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
});
