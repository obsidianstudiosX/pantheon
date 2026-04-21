import { ModelProvider } from 'model-bank';

import type { OpenAICompatibleFactoryOptions } from '../../core/openaiCompatibleFactory';
import { createOpenAICompatibleRuntime } from '../../core/openaiCompatibleFactory';

/**
 * Pantheon — Dispatch
 *
 * Single-model provider that routes every turn through the standard
 * dispatch pipeline (Vesper → Dorothy → target → Eclipse → Diana →
 * Crown) via the Pantheon Gateway at :18790.
 *
 * Exposes one model id: `pantheon-dispatch`. The gateway's pipeline
 * engine picks the target agent from Dorothy's classification.
 */
export const params = {
  baseURL: 'http://host.docker.internal:18790/v1',
  debug: {
    chatCompletion: () => process.env.DEBUG_PANTHEON_CHAT_COMPLETION === '1',
  },
  provider: ModelProvider.PantheonDispatch,
} satisfies OpenAICompatibleFactoryOptions;

export const LobePantheonDispatchAI = createOpenAICompatibleRuntime(params);
