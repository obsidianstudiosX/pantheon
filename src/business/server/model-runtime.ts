import type { ModelRuntimeHooks } from '@lobechat/model-runtime';

import { isPantheonPipelineEnabled } from './pantheon-flag';
import { PantheonChatPipeline } from './pantheon-pipeline';

/**
 * Returns the Pantheon PHI/credential/refusal hooks for a given user+provider
 * when the Pantheon pipeline is enabled. Default off — clinical operator
 * sign-off is required before flipping this anywhere it can touch real users.
 *
 * Both this hook-activation layer AND the stream-wrapper in
 * `src/app/(backend)/webapi/chat/[provider]/route.ts` use the same
 * `isPantheonPipelineEnabled()` helper so the two can never drift — they
 * activate and deactivate together.
 */
export function getBusinessModelRuntimeHooks(
  userId: string,
  provider: string,
): ModelRuntimeHooks | undefined {
  if (!isPantheonPipelineEnabled()) return undefined;
  const pipeline = new PantheonChatPipeline(userId, provider);
  return {
    beforeChat: pipeline.buildPreHook(),
    onChatError: pipeline.buildErrorHook(),
    onChatFinal: pipeline.buildPostHook(),
  };
}
