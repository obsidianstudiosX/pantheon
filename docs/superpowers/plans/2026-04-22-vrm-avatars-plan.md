# Sub-project #5 — VRM Avatars Implementation Plan

**Status:** Draft
**Date:** 2026-04-22
**Spec:** `../specs/2026-04-22-vrm-avatars-design.md`

Bite-sized tasks organised per `superpowers:writing-plans`. Each task names its file paths, the TDD cycle, and what "done" looks like.

---

## Task 0 — Prerequisites (blocked on other agents)

Do **not** start 1+ until:
1. The `tier` → `runtime.family` rename PR has landed; at that point `control-plane/manifests/schemas/agent.schema.json` is editable again (home repo).
2. Operator has approved adding `lobe-vidol` as an npm dependency.

Verification:
- `git log -p control-plane/manifests/schemas/agent.schema.json | head` shows the rename commit.
- `pnpm why lobe-vidol` returns a version.

---

## Task 1 — Extend `vrm` manifest field into an object

**Files:**
- `control-plane/manifests/schemas/agent.schema.json` (home repo; OPERATOR APPROVAL REQUIRED per project rules)
- `control-plane/manifests/agents/*.yaml` — update each to either keep the string form (legacy-compatible) or migrate to the object form.
- `control-plane/src/pantheon_control/projection.py` — projection script must tolerate both forms when emitting fleet files.

**TDD:**
1. RED: add `tests/unit/manifest/test_vrm_object_form.py` (or wherever the home-repo manifest tests live) covering three cases: string, null, object with every field. All fail.
2. GREEN: update schema + projection.
3. REFACTOR: one helper `normaliseVrmBinding(raw)` used by projection and by the shell TS adapter (Task 2).

**Done when:** `pantheon project --agent vesper-command` succeeds and `fleet/pantheon/vesper-command/agent/manifest.json` contains the normalised object form.

---

## Task 2 — TypeScript adapter + types

**Files:**
- `src/features/VRMAvatar/types.ts` — `interface VRMBinding { url: string; poseIdle?: string; voiceTts?: { provider: string; voice: string }; stage?: string; scale?: number; offsetY?: number; }`
- `src/features/VRMAvatar/normalise.ts` — `normaliseVrmBinding(raw: string | null | VRMBindingRaw): VRMBinding | null` (mirror of the Python helper).
- `src/features/VRMAvatar/__tests__/normalise.test.ts` — TDD the adapter (legacy string → `{ url: string }`; object → passthrough; null → null).

**TDD cycle:** 3 RED tests then implementation.

**Done when:** `pnpm vitest run src/features/VRMAvatar/__tests__/normalise.test.ts` passes.

---

## Task 3 — Resolver API route

**Files:**
- `src/app/(backend)/api/pantheon/v1/agents/[slug]/vrm/route.ts` — GET returns `{ url: signedUrl, expiresAt }`. If `NEXT_PUBLIC_VRM_RESOLVER=static`, returns `/branding/vrm/<slug>.vrm` unsigned.
- `src/server/services/vrm/minioSigner.ts` — thin wrapper over the existing `@aws-sdk/client-s3` setup (already in the project for file uploads).
- `src/app/(backend)/api/pantheon/v1/agents/[slug]/vrm/__tests__/route.test.ts` — mocks `pantheon-control-plane` + signer.

**TDD cycle:** two tests — happy path returns a signed URL; 404 when agent has no `vrm` field.

**Done when:** vitest passes and `curl localhost:3210/api/pantheon/v1/agents/vesper-command/vrm` returns a URL.

---

## Task 4 — `useVRMBinding` hook

**Files:**
- `src/features/VRMAvatar/hooks/useVRMBinding.ts` — already scaffolded; replace the mock with a real `fetch('/api/pantheon/v1/agents/<slug>/vrm')` call.
- Extend `src/features/VRMAvatar/__tests__/useVRMBinding.test.tsx` with happy-path and 404 cases (mock `globalThis.fetch` like `RuntimePanel.test.tsx`).

**TDD cycle:** start from the 2 existing scaffold tests; add 2 more (fetch success, fetch 404).

**Done when:** 4 tests green.

---

## Task 5 — Add `lobe-vidol` dependency and wire the real component

**Files:**
- `package.json` — add `"lobe-vidol": "^x.y.z"` (operator approves the exact version). Update `pnpm-lock.yaml`.
- `src/features/VRMAvatar/index.tsx` — replace the Card placeholder with the real Viewer component from lobe-vidol. Keep the `IntersectionObserver` + lazy wrapping from the scaffold.
- `src/features/VRMAvatar/components/Scene.tsx` — new: isolates the actual three.js/lobe-vidol mount point so the SSR-incompatible bits can be dynamically imported.
- `src/features/VRMAvatar/__tests__/VRMAvatar.test.tsx` — extend: assert the real viewer is rendered when binding resolves; fallback `<Avatar>` when binding is null or viewport not intersected.

**TDD cycle:** 4 RED → GREEN passes. Use `vi.mock('lobe-vidol', ...)` to avoid pulling WebGL into happy-dom.

**Done when:** 4 tests green, `pnpm build` succeeds (no SSR / tree-shake breakage), Storybook (if we add one later) renders both placeholder and real modes.

---

## Task 6 — Stage registry

**Files:**
- `src/features/VRMAvatar/stages.ts` — `export const STAGE_REGISTRY: Record<string, string>` keyed by Matrix room alias.
- `public/branding/stages/<room-slug>.webp` — operator supplies assets later; ship a single placeholder `default.webp` only.
- `src/features/VRMAvatar/__tests__/stages.test.ts` — lookup returns image URL; unknown key returns `undefined`.

**TDD cycle:** 2 tests.

---

## Task 7 — Inject into `ChatHeader`

**Files:**
- Locate the chat header component (grep for the active session display name). Candidates: `src/features/Conversation/Header*.tsx`.
- Insert `<VRMAvatar agentSlug={currentAgentSlug} size={128} idle />` behind a feature flag (`VITE_PUBLIC_VRM_AVATARS=1`).
- Snapshot / smoke test for the header.

**Done when:** enabling the flag shows the avatar; disabling reverts to the old 2D picture.

---

## Task 8 — Inject into `AgentGroupAvatar` and agent-select modal

**Files:**
- `src/features/AgentGroupAvatar/index.tsx` — add `vrmBindings?: Record<slug, VRMBinding>` prop, render `<VRMAvatarChip>` per member when present.
- `src/features/AgentSelectionEmpty.tsx` (or the modal that replaces it) — swap each tile's `<Avatar>` for `<VRMAvatarChip>` when the manifest has `vrm`.

---

## Task 9 — Performance polish

- Enforce 2-concurrent-VRM cap (new store slice `src/store/avatar/concurrencySlice.ts`).
- `prefers-reduced-motion` media query observer in the hook.
- Bundle-size budget check in CI (fail if the initial chunk grows > 50 KB from adding lobe-vidol).

---

## Test expectations summary

| Task | New tests | Cumulative |
|---|---|---|
| Scaffold (this PR) | 2 | 2 |
| 2 | 3 | 5 |
| 3 | 2 | 7 |
| 4 | 2 | 9 |
| 5 | 4 | 13 |
| 6 | 2 | 15 |
| 7 | 1 | 16 |
| 8 | 2 | 18 |
| 9 | 2 | 20 |

Target: ≥ 20 tests green, `pnpm exec tsc --noEmit --skipLibCheck` clean for new files, no regressions in `pnpm test-app`.

## Estimated LOC delta (post-rename landing)

- Shell fork: ~750 lines added (real component ~250, resolver API ~80, hook ~60, tests ~260, types/adapters/stages ~100).
- Home repo: ~40 lines (schema change + one Python helper + YAML migrations are codegen'd).
