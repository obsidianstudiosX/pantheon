import { useQuery } from '@tanstack/react-query';

/**
 * Normalised runtime shape of the per-agent VRM binding.
 *
 * Mirrors the object form proposed in the design spec:
 *   docs/superpowers/specs/2026-04-22-vrm-avatars-design.md §1-2.
 *
 * The manifest field `vrm` may today be a bare `string` (URL-ish path) or
 * null. Task 2 in the plan upgrades it to an object; the normaliser in this
 * hook accepts either shape so callers see a single, predictable type.
 */
export interface VRMBinding {
  /** Resolvable URL or logical handle (e.g. `/branding/vrm/<slug>.vrm`). */
  url: string;
  /** Idle animation preset name. */
  poseIdle?: string;
  /** Bound @lobehub/tts voice, once wired. */
  voiceTts?: { provider: string; voice: string };
  /** Matrix room alias whose stage background should render behind the avatar. */
  stage?: string;
  /** Optional model scale multiplier. */
  scale?: number;
  /** Optional vertical offset inside the scene. */
  offsetY?: number;
}

/**
 * Static mock catalog used by the scaffold. Replaced in Task 3/4 of the plan
 * with a real fetch to `/api/pantheon/v1/agents/<slug>/vrm`.
 *
 * Seed data is intentionally small; only the slugs listed here resolve to a
 * binding, everything else returns `null` so the fallback branch in
 * `<VRMAvatar>` can be exercised.
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
 * Scaffold semantics:
 *   - Returns a binding from MOCK_CATALOG for known slugs.
 *   - Returns `null` (not an error) for unknown slugs so the UI can fall back
 *     to a 2D avatar without treating it as a failure state.
 *   - Disabled for empty slugs.
 */
export function useVRMBinding(agentSlug: string) {
  return useQuery<VRMBinding | null>({
    enabled: Boolean(agentSlug),
    queryFn: async () => {
      // TODO(#sub-project-5 Task 3): swap for
      //   fetch(`/api/pantheon/v1/agents/${agentSlug}/vrm`)
      //     .then(r => r.ok ? r.json() : null)
      return MOCK_CATALOG[agentSlug] ?? null;
    },
    queryKey: [VRM_BINDING_QUERY_KEY, agentSlug],
    staleTime: 60_000,
  });
}
