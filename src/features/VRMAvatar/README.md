# VRMAvatar

Scaffold for sub-project #5 (VRM Avatars). Renders a per-agent 3D portrait
in the chat UI, driven by the `vrm` field on the agent manifest.

**Status: SCAFFOLD.** Only the component shell, the react-query hook, and
tests are in place. The real `lobe-vidol` integration is deferred until
(a) the `tier` → `runtime.family` rename lands in the home repo and
(b) operator approval to add `lobe-vidol` as an npm dependency.

## What this directory contains

| File | Purpose |
|---|---|
| `index.tsx` | `<VRMAvatar agentSlug size idle />` — placeholder Card today; will wrap the lobe-vidol Viewer later. |
| `hooks/useVRMBinding.ts` | react-query hook. Returns a `VRMBinding` (URL + pose + stage + voice) for known slugs; `null` for unknown. Wraps a static mock catalog today; will hit `/api/pantheon/v1/agents/<slug>/vrm` after Task 3 in the plan. |
| `__tests__/VRMAvatar.test.tsx` | 3 tests: known slug renders, unknown slug falls back, `size` prop applies. |
| `README.md` | You are here. |

## TODOs (do not remove until closed)

- [ ] **Replace the Card placeholder in `index.tsx`** with lobe-vidol's Viewer, mounted in a lazily-imported `components/Scene.tsx`. Wrap with `IntersectionObserver` so the 5–20 MB model only loads when visible (spec §6).
- [ ] **Swap the mock hook for a real resolver fetch** to `/api/pantheon/v1/agents/<slug>/vrm` (plan Task 3).
- [ ] **Wire `@lobehub/tts`** using `binding.voiceTts` — bind the mouth-lip-sync callback off TTS streaming.
- [ ] **Stage backgrounds.** `STAGE_REGISTRY` in `stages.ts` (to be created) maps Matrix room aliases → webp URL; rendered behind the avatar.
- [ ] **Feature flag.** Gate real rendering behind `NEXT_PUBLIC_VRM_AVATARS=1` until the full pipeline ships.

## Intended injection points (not wired yet)

1. `src/features/Conversation/.../ChatHeader` — large (`size={128}`) avatar next to the active agent's display name.
2. `src/features/AgentGroupAvatar` — small (`size={32}`) avatar per member when the group is a single Pantheon agent.
3. Agent-select modal tiles — medium (`size={96}`) preview.

## Ownership

- **Tier**: shell (fork). All code here lives under `src/features/VRMAvatar/`.
- **Dependencies**: react, antd (for the scaffold Card), `@tanstack/react-query`. No lobe-vidol yet.

## See also

- Design spec: `docs/superpowers/specs/2026-04-22-vrm-avatars-design.md`
- Implementation plan: `docs/superpowers/plans/2026-04-22-vrm-avatars-plan.md`
- Agent manifest schema (home repo): `control-plane/manifests/schemas/agent.schema.json`
  — `vrm` field currently `string | null`; upgrade to the object form is Task 1.
