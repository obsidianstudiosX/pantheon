import type { ModelProviderCard } from '@/types/llm';

import { isPantheonProvidersEnabled } from './pantheon';

/**
 * Pantheon — Dispatch.
 *
 * Single-model OpenAI-compatible provider whose one entry (`pantheon-dispatch`)
 * auto-routes every turn through the standard Pantheon pipeline
 * (Vesper → Dorothy classify → target agent → Eclipse → Diana).
 *
 * Points at the same gateway as the "Pantheon — Direct" provider
 * (`http://127.0.0.1:18790/v1`); the gateway disambiguates by model id.
 *
 * Feature-flag behaviour matches `pantheon.ts` (enabled in dev, opt-in via
 * `NEXT_PUBLIC_PANTHEON_PROVIDERS=1` in production).
 *
 * Spec: docs/superpowers/specs/2026-04-22-gateway-design.md §D3.
 */

const PantheonDispatch: ModelProviderCard = {
  chatModels: [],
  checkModel: 'pantheon-dispatch',
  description:
    'Pantheon — Dispatch auto-routes every turn through the standard agent pipeline. One model, `pantheon-dispatch`, is exposed; the gateway picks the right agent for you.',
  enabled: isPantheonProvidersEnabled(),
  id: 'pantheon-dispatch',
  modelList: { showModelFetcher: false },
  name: 'Pantheon — Dispatch',
  settings: {
    proxyUrl: {
      placeholder: 'http://127.0.0.1:18790/v1',
    },
    sdkType: 'openai',
    showModelFetcher: false,
  },
  url: 'https://github.com/obsidianstudiosX/obsidian-pantheon',
};

export default PantheonDispatch;
