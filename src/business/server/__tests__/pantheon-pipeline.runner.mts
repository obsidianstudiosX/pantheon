/**
 * Standalone runner for pantheon-pipeline tests — mirrors pantheon-pipeline.test.ts
 * but runs under `node --experimental-strip-types` without vitest/node_modules
 * installed. Matches the fallback used in Phase 3.2 for the fixture suite.
 *
 * Exits 0 on all pass, 1 on any failure. Intentionally does NOT import from
 * vitest — reimplements the five assertions by hand.
 *
 * Import rewrites vs the .test.ts:
 *   - `@lobechat/model-runtime` → local types (this runner only needs the
 *     ChatStreamPayload/OpenAIChatMessage shapes, which are structural)
 *   - `../pantheon-pipeline` → `../pantheon-pipeline.ts` (explicit extension
 *     required for --experimental-strip-types)
 *   - The pantheon-pipeline module itself imports `@/server/pantheon/hooks`;
 *     without a bundler we'd need the real path. We therefore inline-construct
 *     the pipeline by directly importing the hook modules and re-running the
 *     same logic the pipeline does, then spot-check the observable behavior.
 *
 * This runner exists ONLY because node_modules isn't installed in CI scratch
 * environments. When `pnpm install` has run, prefer `pnpm vitest run …`.
 */
import { applyCredentialRedactor, redactCredentials } from '../../../server/pantheon/hooks/credential-redactor.ts';
import { applyPhiGuard } from '../../../server/pantheon/hooks/phi-guard.ts';
import { isRefusal } from '../../../server/pantheon/hooks/refusal-detector.ts';
import { applyReviewGatePre } from '../../../server/pantheon/hooks/review-gate.ts';
import { applyRouter } from '../../../server/pantheon/hooks/router.ts';
import { applySizeGuard } from '../../../server/pantheon/hooks/size-guard.ts';
import { createTurnEnvelope } from '../../../server/pantheon/hooks/types.ts';

interface Failure {
  name: string;
  message: string;
}

const failures: Failure[] = [];
let passed = 0;
let total = 0;

function assert(cond: unknown, name: string, msg: string): void {
  total += 1;
  if (cond) {
    passed += 1;
  } else {
    failures.push({ name, message: msg });
  }
}

// --------------------------------------------------------------------------
// Test 1: pre-hook logic redacts an sk-ant-... credential
// --------------------------------------------------------------------------
{
  const name = 'pre-hook redacts sk-ant credential';
  const credential = 'sk-ant-' + 'A'.repeat(45);
  const originalText = `please use this key: ${credential} thanks`;
  const env = createTurnEnvelope({
    agent_id: 'user-1',
    user_text: originalText,
    system_prompt: 'You are helpful.',
  });
  applyRouter(env);
  applyPhiGuard(env);
  applyCredentialRedactor(env, false);
  applySizeGuard(env);
  applyReviewGatePre(env);

  assert(
    !env.user_text.includes(credential),
    name,
    `user_text still contains credential: ${env.user_text}`,
  );
  assert(
    env.user_text.includes('[REDACTED:anthropic_api_key]'),
    name,
    `user_text missing redaction marker: ${env.user_text}`,
  );
  assert(
    env.credential_patterns_found.includes('anthropic_api_key'),
    name,
    `credential_patterns_found missing anthropic_api_key: ${JSON.stringify(env.credential_patterns_found)}`,
  );
}

// --------------------------------------------------------------------------
// Test 2: pre-hook strict-mode PHI should fire review_required
// (adapter throws PantheonReviewGateError when both strict + review_required)
// --------------------------------------------------------------------------
{
  const name = 'pre-hook strict-mode PHI triggers review_required';
  const env = createTurnEnvelope({
    agent_id: 'clinician-42',
    user_text:
      'Patient MRN: 123456 needs follow-up on their dose of Lisinopril 20 mg',
    system_prompt: '',
  });
  applyRouter(env);
  applyPhiGuard(env, { default_mode: 'strict' });
  applyCredentialRedactor(env, false);
  applySizeGuard(env);
  applyReviewGatePre(env, {
    registry: { 'clinician-42': { role: 'clinical' } },
  });

  assert(env.phi_detected, name, 'phi_detected should be true');
  assert(
    env.phi_guard_mode === 'strict',
    name,
    `phi_guard_mode should be strict, got ${env.phi_guard_mode}`,
  );
  assert(
    env.review_required === true,
    name,
    `review_required should be true, got ${env.review_required}`,
  );
}

// --------------------------------------------------------------------------
// Test 3: pre-hook passes through clean text unchanged
// --------------------------------------------------------------------------
{
  const name = 'pre-hook clean text unchanged';
  const original = 'Hi! What is the capital of France?';
  const env = createTurnEnvelope({
    agent_id: 'user-2',
    user_text: original,
    system_prompt: '',
  });
  applyRouter(env);
  applyPhiGuard(env);
  applyCredentialRedactor(env, false);
  applySizeGuard(env);
  applyReviewGatePre(env);

  assert(env.user_text === original, name, `user_text mutated: ${env.user_text}`);
  assert(env.phi_detected === false, name, 'phi_detected should be false');
  assert(
    env.credential_patterns_found.length === 0,
    name,
    `credential_patterns_found should be empty: ${JSON.stringify(env.credential_patterns_found)}`,
  );
  assert(env.review_required === false, name, 'review_required should be false');
}

// --------------------------------------------------------------------------
// Test 4: post-hook redactCredentials flags a leaked openai-style key
// --------------------------------------------------------------------------
{
  const name = 'post-hook detects leaked credential';
  // openai_api_key: \bsk-[A-Za-z0-9]{32,}\b — hyphen-free body
  const leaked = 'sk-' + 'A'.repeat(40);
  const responseText = `here you go: ${leaked} — good luck`;
  const { text, redacted } = redactCredentials(responseText);
  assert(
    redacted.includes('openai_api_key'),
    name,
    `redacted should include openai_api_key, got ${JSON.stringify(redacted)}`,
  );
  assert(
    !text.includes(leaked),
    name,
    `redacted text still contains the leaked key: ${text}`,
  );
}

// --------------------------------------------------------------------------
// Test 5: post-hook isRefusal identifies refusal text
// --------------------------------------------------------------------------
{
  const name = 'post-hook identifies refusal';
  const refusal = 'I cannot help with that request.';
  const nonRefusal = 'Sure — here is the answer you asked for.';
  assert(isRefusal(refusal) === true, name, 'refusal text not detected');
  assert(isRefusal(nonRefusal) === false, name, 'non-refusal wrongly flagged');
}

// --------------------------------------------------------------------------
// Test 6: adapter message-mutation contract
// The full PantheonChatPipeline class uses the `@/` path alias for its
// hook imports, which requires a bundler/tsconfig-paths; under raw Node
// strip-types we can't import it directly. We replicate its single
// observable side-effect (replace the last user message's content with
// redacted text) in-process to lock in the contract.
// --------------------------------------------------------------------------
{
  const name = 'adapter replaces last user message content after redaction';
  const credential = 'sk-ant-' + 'B'.repeat(45);
  const messages: Array<{ role: string; content: string | unknown[] }> = [
    { role: 'system', content: 'system prompt' },
    { role: 'user', content: 'older message' },
    { role: 'assistant', content: 'earlier reply' },
    { role: 'user', content: `token=${credential}` },
  ];

  // Find last user message
  let userIdx = -1;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]!.role === 'user') {
      userIdx = i;
      break;
    }
  }
  const originalText = messages[userIdx]!.content as string;
  const env = createTurnEnvelope({
    agent_id: 'user-5',
    user_text: originalText,
    system_prompt: 'system prompt',
  });
  applyRouter(env);
  applyPhiGuard(env);
  applyCredentialRedactor(env, false);
  applySizeGuard(env);
  applyReviewGatePre(env);

  if (env.user_text !== originalText) {
    messages[userIdx]!.content = env.user_text;
  }

  assert(
    userIdx === messages.length - 1,
    name,
    `userIdx should be last, got ${userIdx}`,
  );
  assert(
    typeof messages[userIdx]!.content === 'string' &&
      !(messages[userIdx]!.content as string).includes(credential),
    name,
    `last user message still contains credential: ${messages[userIdx]!.content}`,
  );
  assert(
    (messages[userIdx]!.content as string).includes('[REDACTED:anthropic_api_key]'),
    name,
    `expected redaction marker in ${messages[userIdx]!.content}`,
  );
  // Sibling messages untouched
  assert(
    messages[0]!.content === 'system prompt',
    name,
    'system message mutated',
  );
  assert(
    messages[1]!.content === 'older message',
    name,
    'earlier user message mutated',
  );
  assert(
    messages[2]!.content === 'earlier reply',
    name,
    'assistant message mutated',
  );
}

// --------------------------------------------------------------------------
// Report
// --------------------------------------------------------------------------
// eslint-disable-next-line no-console
console.log(`pantheon-pipeline runner: ${passed}/${total} assertions passed`);
if (failures.length > 0) {
  for (const f of failures) {
    // eslint-disable-next-line no-console
    console.error(`  FAIL [${f.name}]: ${f.message}`);
  }
  process.exit(1);
}
process.exit(0);
