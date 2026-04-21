/**
 * Stage background registry.
 *
 * Maps Matrix room aliases (as emitted by the control plane per-agent
 * manifest) to a background image URL. Rendered behind the 3D avatar.
 *
 * Design §5: flat 2D (or panoramic) images only; full 3D scenes are out
 * of scope. Manifest `vrm.stage` overrides entries in this registry.
 *
 * Assets live under `public/branding/stages/`. We ship only the `default`
 * key initially; operator supplies per-room assets later.
 */

export const DEFAULT_STAGE_URL = '/branding/stages/default.webp';

export const STAGE_REGISTRY: Record<string, string> = {
  '#clinical-chamber:pantheon': '/branding/stages/clinical-chamber.webp',
  '#goddess-council:pantheon': '/branding/stages/goddess-council.webp',
  '#heretic-forge:pantheon': '/branding/stages/heretic-forge.webp',
};

/**
 * Resolve a stage URL for a Matrix room alias (or explicit URL).
 *
 * Priority:
 *   1. If `aliasOrUrl` looks like an absolute URL (http/https) or rooted
 *      path (starts with `/`), return it verbatim — this covers the
 *      manifest override case where the agent supplies a direct asset path.
 *   2. Otherwise look up the registry.
 *   3. Undefined when unknown (caller decides between DEFAULT_STAGE_URL and
 *      the gradient fallback).
 */
export function resolveStageUrl(aliasOrUrl: string | undefined | null): string | undefined {
  if (!aliasOrUrl) return undefined;
  if (
    aliasOrUrl.startsWith('/') ||
    aliasOrUrl.startsWith('http://') ||
    aliasOrUrl.startsWith('https://')
  ) {
    return aliasOrUrl;
  }
  return STAGE_REGISTRY[aliasOrUrl];
}
