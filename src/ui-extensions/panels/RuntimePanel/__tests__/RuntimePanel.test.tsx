import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RuntimePanel } from '../RuntimePanel';

const buildWrapper = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

const mockAgent = {
  display_name: 'Rapi',
  matrix: undefined,
  orchestration: {
    dispatches_to: [],
    phi_aware: false,
    pipeline_membership: ['default'],
    receives_from: [],
    verify_required: false,
  },
  policy: {
    allowed_platforms: [],
    phi_guard_mode: 'strict',
    review_gate: false,
  },
  memory: {
    local_path: '/opt/obsidian-pantheon/shared/shards/rapi',
    shards: ['S', 'A'],
  },
  canon: {
    agency: 'Nikke / Counters',
    character: 'Rapi',
    role: 'Advocate',
    source: 'Nikke',
  },
  runtime: {
    binary: '/usr/bin/rapi',
    fleet_path: '/opt/pantheon-fleet/rapi',
    implementation: 'openclaw-runtime',
    implementation_version: '1.2.3',
    systemd_unit: 'pantheon-rapi.service',
    tier: 'openclaw',
    version: '1.2.3',
  },
  slug: 'rapi-advocate',
};

describe('RuntimePanel', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify(mockAgent), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }),
    ) as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders tier, implementation and systemd unit once loaded', async () => {
    const Wrapper = buildWrapper();
    render(
      <Wrapper>
        <RuntimePanel agentSlug="rapi-advocate" />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText('openclaw')).toBeTruthy();
    });
    expect(screen.getByText('openclaw-runtime')).toBeTruthy();
    expect(screen.getByText('pantheon-rapi.service')).toBeTruthy();
    expect(screen.getByText('/opt/pantheon-fleet/rapi')).toBeTruthy();
  });

  it('renders error state on fetch failure', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response('boom', { status: 500 }),
    ) as unknown as typeof fetch;

    const Wrapper = buildWrapper();
    render(
      <Wrapper>
        <RuntimePanel agentSlug="missing" />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Failed to load runtime/i)).toBeTruthy();
    });
  });
});
