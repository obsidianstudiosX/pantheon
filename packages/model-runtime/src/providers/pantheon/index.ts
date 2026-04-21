import { ModelProvider } from 'model-bank';

import type { OpenAICompatibleFactoryOptions } from '../../core/openaiCompatibleFactory';
import { createOpenAICompatibleRuntime } from '../../core/openaiCompatibleFactory';

/**
 * Pantheon — Direct
 *
 * OpenAI-compatible wrapper around the Pantheon control-plane Gateway
 * (control-plane/api/handlers/gateway.py) running on the host at
 * :18790. Each model id is `pantheon-<slug>` — one of the 26 agents in
 * `control-plane/manifests/agents/`. The gateway routes the turn through
 * the direct pipeline (_execute_direct in pipeline.py) — no Vesper/
 * Dorothy classification, just one agent answering.
 *
 * URL: from inside the pantheon-app container, the host is reachable
 * via `host.docker.internal`. Defaults here; users can override via
 * proxyUrl in settings.
 */
export const params = {
  baseURL: 'http://host.docker.internal:18790/v1',
  debug: {
    chatCompletion: () => process.env.DEBUG_PANTHEON_CHAT_COMPLETION === '1',
  },
  provider: ModelProvider.Pantheon,
} satisfies OpenAICompatibleFactoryOptions;

export const LobePantheonAI = createOpenAICompatibleRuntime(params);
