import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import VRMAvatar from '../index';

const buildWrapper = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

describe('VRMAvatar (scaffold)', () => {
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
    // The card title includes the slug.
    expect(screen.getByText('VRM: rapi-advocate')).toBeTruthy();
    // The mock URL is rendered as a code snippet.
    expect(screen.getByText('/branding/vrm/rapi-advocate.vrm')).toBeTruthy();
  });

  it('renders fallback for an unknown agent slug', async () => {
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
    // Width/height on the root Card element should reflect the size prop.
    const card = container.querySelector('[data-testid="vrm-avatar-vesper-command"]') as HTMLElement;
    expect(card.style.width).toBe('160px');
    expect(card.style.height).toBe('160px');
  });
});
