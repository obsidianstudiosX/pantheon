import type { ModelRuntimeHooks } from '@lobechat/model-runtime';

import { PantheonChatPipeline } from './pantheon-pipeline';

/**
 * Returns the Pantheon PHI/credential/refusal hooks for a given user+provider
 * when `PANTHEON_PIPELINE_ENABLED=1`. Default off — clinical operator sign-off
 * is required before flipping this anywhere it can touch real users.
 */
export function getBusinessModelRuntimeHooks(
  userId: string,
  provider: string,
): ModelRuntimeHooks | undefined {
  if (process.env.PANTHEON_PIPELINE_ENABLED !== '1') return undefined;
  const pipeline = new PantheonChatPipeline(userId, provider);
  return {
    beforeChat: pipeline.buildPreHook(),
    onChatError: pipeline.buildErrorHook(),
    onChatFinal: pipeline.buildPostHook(),
  };
}
