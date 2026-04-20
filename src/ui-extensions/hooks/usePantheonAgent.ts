import { useQuery } from '@tanstack/react-query';

import type {
  CanonManifest,
  MatrixManifest,
  MemoryManifest,
  OrchestrationManifest,
  PolicyManifest,
  RuntimeManifest,
} from '../types/manifest';

/**
 * Shape of the `/api/pantheon/v1/agents/:slug` response served by the
 * control-plane API (Wave E, running on 127.0.0.1:18790). Shell backend
 * proxies via `src/app/(backend)/api/pantheon/[[...path]]/route.ts`.
 *
 * Not every field from the full manifest is returned — this is the subset
 * the UI extension panels consume.
 */
export interface PantheonAgent {
  slug: string;
  display_name: string;
  runtime: RuntimeManifest & { version: string };
  canon: CanonManifest;
  orchestration: OrchestrationManifest;
  policy: PolicyManifest;
  memory: MemoryManifest;
  matrix?: MatrixManifest;
}

const PANTHEON_AGENT_QUERY_KEY = 'pantheon-agent';

export function usePantheonAgent(slug: string) {
  return useQuery<PantheonAgent>({
    enabled: Boolean(slug),
    queryFn: async () => {
      const response = await fetch(`/api/pantheon/v1/agents/${slug}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch Pantheon agent ${slug}: ${response.status}`);
      }
      return (await response.json()) as PantheonAgent;
    },
    queryKey: [PANTHEON_AGENT_QUERY_KEY, slug],
    staleTime: 60_000,
  });
}

export { PANTHEON_AGENT_QUERY_KEY };
