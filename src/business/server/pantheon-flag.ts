/**
 * Single source of truth for the Pantheon pipeline feature flag. Imported
 * by route.ts (stream wrapper) AND model-runtime.ts (hook activation) so
 * the two layers can't drift into a split-brain state — either BOTH layers
 * are active or NEITHER is. Any future code path that touches the pipeline
 * must go through this helper.
 *
 * Activation requires `PANTHEON_PIPELINE_ENABLED=1` in the process env.
 * Default is off. Clinical operator sign-off is required before enabling
 * in any environment that can touch real clinical data. See the memory
 * file `clinical_signoff.md` for the authorization record.
 */
export function isPantheonPipelineEnabled(): boolean {
  return process.env.PANTHEON_PIPELINE_ENABLED === '1';
}
