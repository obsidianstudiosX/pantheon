import { type ChatCompletionErrorPayload } from '@lobechat/model-runtime';
import { AGENT_RUNTIME_ERROR_SET } from '@lobechat/model-runtime';
import { ChatErrorType } from '@lobechat/types';

import { checkAuth } from '@/app/(backend)/middleware/auth';
import { isPantheonPipelineEnabled } from '@/business/server/pantheon-flag';
import { PantheonReviewGateError } from '@/business/server/pantheon-pipeline';
import { wrapResponseWithCredentialRedactor } from '@/business/server/streaming-credential-redactor';
import { createTraceOptions, initModelRuntimeFromDB } from '@/server/modules/ModelRuntime';
import { type ChatStreamPayload } from '@/types/openai/chat';
import { createErrorResponse } from '@/utils/errorResponse';
import { getTracePayload } from '@/utils/trace';

// If user don't use fluid compute, will build  failed
// this enforce user to enable fluid compute
export const maxDuration = 300;

export const POST = checkAuth(async (req: Request, { params, userId, serverDB }) => {
  const provider = (await params)!.provider!;

  try {
    // ============  1. init chat model   ============ //
    const modelRuntime = await initModelRuntimeFromDB(serverDB, userId, provider);

    // ============  2. create chat completion   ============ //

    const data = (await req.json()) as ChatStreamPayload;

    const tracePayload = getTracePayload(req);

    let traceOptions = {};
    // If user enable trace
    if (tracePayload?.enabled) {
      traceOptions = createTraceOptions(data, { provider, trace: tracePayload });
    }

    const response = await modelRuntime.chat(data, {
      user: userId,
      ...traceOptions,
      signal: req.signal,
    });

    // Pantheon Phase 3.3: redact leaked credentials in-flight before the
    // SSE bytes reach the HTTP client. Single HTTP choke point — all
    // chat traffic from LobeHub v2 flows through this route handler, so
    // wrapping here covers every provider without touching model-runtime
    // internals. Shared-flag gated with model-runtime.ts so the two layers
    // activate/deactivate together. Default off until clinical sign-off.
    if (isPantheonPipelineEnabled()) {
      return wrapResponseWithCredentialRedactor(response);
    }
    return response;
  } catch (e) {
    // Pantheon review-gate abort: strict-mode PHI in the user message
    // caused `beforeChat` to throw. Return a sanitized 422 — do NOT echo
    // the error message, which may reference PHI categories. The operator
    // has audit visibility through `[pantheon-pipeline] pre BLOCKED ...`
    // in server logs; the client gets only a neutral directive.
    if (e instanceof PantheonReviewGateError) {
      return new Response(
        JSON.stringify({
          code: 'PANTHEON_REVIEW_REQUIRED',
          message:
            'This message requires operator review before it can be dispatched. Edit the content and retry.',
        }),
        {
          headers: { 'content-type': 'application/json' },
          status: 422,
        },
      );
    }

    const {
      errorType = ChatErrorType.InternalServerError,
      error: errorContent,
      ...res
    } = e as ChatCompletionErrorPayload;

    const error = errorContent || e;

    const logMethod = AGENT_RUNTIME_ERROR_SET.has(errorType as string) ? 'warn' : 'error';
    // track the error at server side
    // eslint-disable-next-line no-console
    console[logMethod](`Route: [${provider}] ${errorType}:`, error);

    return createErrorResponse(errorType, { error, ...res, provider });
  }
});
