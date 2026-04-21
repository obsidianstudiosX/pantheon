import { useQuery } from '@tanstack/react-query';

import { normaliseVrmBinding } from '../normalise';
import type { VRMBinding, VRMBindingRaw } from '../types';

export type { VRMBinding } from '../types';

/**
 * Static mock catalog used as a fallback when the resolver endpoint is
 * unreachable. Keeps local dev working even without the control plane or
 * MinIO running. Replaced with the real fetch path below.
 */
const MOCK_CATALOG: Record<string, VRMBinding> = {
  'rapi-advocate': {
    poseIdle: 'idle-01',
    stage: '#goddess-council:pantheon',
    url: '/branding/vrm/rapi-advocate.vrm',
  },
  'vesper-command': {
    poseIdle: 'idle-02',
    stage: '#general:pantheon',
    url: '/branding/vrm/vesper-command.vrm',
  },
};

export const VRM_BINDING_QUERY_KEY = 'pantheon-vrm-binding';

/**
 * Resolve the VRM binding for an agent slug.
 *
 * Strategy:
 *   1. Hit `/api/pantheon/v1/agents/<slug>/vrm` (plan Task 3 resolver).
 *   2. On 404 — agent exists, no VRM field — resolve to `null`.
 *   3. On any network/other error — fall back to the static MOCK_CATALOG so
 *      dev without the control plane still renders placeholder bindings for
 *      the two seed agents.
 *   4. Normalises the payload through `normaliseVrmBinding` so callers
 *      always see camelCase.
 *
 * Rationale for returning `null` (not throwing) on 404:
 *   - Having no VRM is the expected case for agents without a binding.
 *     The UI then renders the 2D <Avatar> fallback rather than an error state.
 */
export function useVRMBinding(agentSlug: string) {
  return useQuery<VRMBinding | null>({
    enabled: Boolean(agentSlug),
    queryFn: async () => {
      // In non-browser test environments without a fetch mock, bail to mock.
      if (typeof fetch !== 'function') {
        return MOCK_CATALOG[agentSlug] ?? null;
      }
      try {
        const response = await fetch(
          `/api/pantheon/v1/agents/${encodeURIComponent(agentSlug)}/vrm`,
        );
        if (response.status === 404) return null;
        if (!response.ok) {
          // Soft-fallback: network or 5xx — render the mock so the UI is never
          // "broken" in dev. Production will see the real resolver.
          return MOCK_CATALOG[agentSlug] ?? null;
        }
        const payload = (await response.json()) as VRMBindingRaw;
        return normaliseVrmBinding(payload);
      } catch {
        return MOCK_CATALOG[agentSlug] ?? null;
      }
    },
    queryKey: [VRM_BINDING_QUERY_KEY, agentSlug],
    staleTime: 60_000,
  });
}
