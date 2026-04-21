# Sub-project #5 — VRM Avatars Design Spec

**Status:** Draft
**Date:** 2026-04-22
**Owner:** Shell (LobeHub fork)
**Scope:** Groundwork only. Full integration deferred to the plan in `../plans/2026-04-22-vrm-avatars-plan.md`.

## Goal

Let each Pantheon agent have a 3D animated VRM portrait in the chat UI, backed by the existing `vrm` field on the agent manifest. Use the `lobe-vidol` component library once it is added as a dependency. This spec resolves the six design decisions listed in the groundwork brief; it does not hand-wire `lobe-vidol` yet.

## Existing inputs

- `control-plane/manifests/schemas/agent.schema.json` already declares `vrm` as `string | null` (line 43) — a URL-ish path.
- Every agent manifest already ships `vrm: /branding/vrm/<slug>.vrm` (confirmed on `vesper-command.yaml`).
- Nothing under `/opt/pantheon/src/public/branding/vrm/` exists yet; the files are notional.
- The master plan (`/opt/obsidian-pantheon/HANDOFF/UNIFIED-PLAN-2026-04-20.md` lines 126–131) calls out:
  - 25 agents get a VRM (all except `vesper-command`).
  - Stage backgrounds = Matrix rooms (Goddess Council chamber, Heretic Forge, Clinical Chamber, ...).
  - Per-agent TTS voice via `@lobehub/tts` React hooks.

## Decisions

### 1. Where do VRM models live?

**Decision: (c) MinIO (pantheon-minio) with signed URLs, fronted by a tiny resolver endpoint.**

Rationale:
- VRMs are 5–20 MB. Tracking them in git (option a) bloats clones and forces git-lfs, which the fork does not currently use; adding lfs is an operator-level decision with rebase consequences against upstream LobeHub.
- A public CDN (option b) works but we already run a MinIO container for object storage; reusing it keeps the entire asset pipeline on-prem, respects the PHI posture (though VRMs themselves are not PHI), and supports per-agent access control if we ever want it.
- Concretely: the manifest string `vrm: /branding/vrm/<slug>.vrm` becomes a *logical* handle. The UI resolves it to a MinIO signed URL through `/api/pantheon/v1/agents/<slug>/vrm` (new route, Wave E style). The resolver does the signing server-side.
- A 4 KB placeholder `.vrm`-pointer JSON may be committed under `public/branding/vrm/<slug>.vrm.meta.json` for dev environments that do not run MinIO — the resolver falls back to that.

Fallback for dev without MinIO: `NEXT_PUBLIC_VRM_RESOLVER=static` points the hook at `/branding/vrm/<slug>.vrm` directly from `public/`.

### 2. Binding per-agent to VRM model

**Decision: Extend the manifest `vrm` field into an object and keep it in-manifest (no new DB table yet).**

New `vrm` shape in `agent.schema.json` (to be made in the *home* repo — not part of this groundwork PR because that path is currently excluded by the tier→runtime rename):

```jsonc
"vrm": {
  "oneOf": [
    { "type": "string" },                // legacy: just a URL/handle
    { "type": "null" },
    {
      "type": "object",
      "required": ["url"],
      "properties": {
        "url": { "type": "string" },     // MinIO handle or static path
        "pose_idle": { "type": "string" },     // animation name from lobe-vidol preset
        "voice_tts": {                    // bound @lobehub/tts voice
          "type": "object",
          "properties": {
            "provider": { "type": "string" },
            "voice": { "type": "string" }
          }
        },
        "stage": { "type": "string" },   // matrix room id / alias whose scene renders behind
        "scale": { "type": "number" },
        "offset_y": { "type": "number" }
      }
    }
  ]
}
```

Rationale for picking the object-in-manifest route over a new `pantheon_agent_avatar_bindings` table:
- One source of truth. The manifest is already the canonical store (per home repo CLAUDE.md rule 8); splitting avatar binding into a DB table duplicates that.
- Everything on the object is configuration, not runtime state. Runtime state (e.g., "user last selected this idle animation on this device") can later go in a local-only store slice (`store/avatar/`).
- Keeps the old string form working; the TS adapter normalises both shapes.

### 3. Component surface area

**Decision:** Two React components plus one hook.

- `<VRMAvatar agentSlug size idle />` — the main component. Renders the 3D scene (or placeholder while scaffolding) at a caller-specified size. Used in:
  - The agent-select modal (replace or overlay the 2D avatar).
  - The conversation header next to the active agent's display name.
- `<VRMAvatarChip agentSlug />` — a tiny 32–48 px version for chat bubbles and mentions. Internally delegates to `<VRMAvatar size={...} idle />` but turns off heavy effects (camera controls, speaking loop) for density.
- `useVRMBinding(agentSlug)` — react-query hook returning the resolved binding `{ url, pose_idle, voice_tts, stage }`.

Initial injection points (implementation ships with placeholder component only; wiring happens in the plan):
1. `src/features/AgentGroupAvatar` — fall back to `<VRMAvatarChip>` when a single-agent room has `vrm`.
2. `src/features/Conversation/.../ChatHeader` — larger `<VRMAvatar size={128} />` for the active agent.
3. Next-step only: agent-select modal.

### 4. Animations

**Decision: default to lobe-vidol presets; per-agent overrides via the `pose_idle` manifest field.**

- Idle loop: reuse lobe-vidol's `idle-01` preset unless `vrm.pose_idle` is set.
- Speaking loop: reuse lobe-vidol's `talking` preset, triggered off the existing chat streaming event.
- Click reaction: single default `greet` preset; extensible by supplying `vrm.pose_click` (added as an opt-in extension property — does not break the schema because the object form allows additional properties already via JSON schema `additionalProperties`).
- Extension point: `<VRMAvatar onLipSync={...} onReaction={...} />` render-prop-style hooks so features like clinical dictation can drive the mouth off TTS output.

### 5. Stages

**Decision: A "stage" is a background image (flat 2D or panoramic) layered behind the 3D avatar, keyed by Matrix room id.**

- Full 3D scenes are out of scope (cost, load time, model complexity).
- Mapping stored in `public/branding/stages/<room-slug>.webp` with a TypeScript registry `src/features/VRMAvatar/stages.ts` that maps Matrix room aliases → stage image URL. The manifest `vrm.stage` field may override by giving an explicit URL.
- When no stage is resolvable, render a radial gradient background using the agent's canonical `emoji` color hue — this is the already-established `<Avatar>` fallback pattern.

### 6. Performance

**Decision: lazy-load VRM asset only when the avatar enters the viewport AND the user hasn't set the "reduce 3D" preference.**

Implementation shape:
- `<VRMAvatar>` is a client component wrapped in `React.lazy()` so its lobe-vidol dependencies are not pulled into the initial chunk.
- Use `IntersectionObserver` at the component boundary. Until the avatar intersects a 256 px rootMargin band, render the 2D `<Avatar>` placeholder.
- Respect `prefers-reduced-motion` + a new `settings.avatar.mode: 'vrm' | 'img' | 'off'` preference (defaults to `vrm` on desktop, `img` on mobile and when the media query is set).
- On screens with >4 visible VRMs (e.g., agent-select grid), auto-downgrade all but the hovered tile to `img` mode. Hard cap of 2 concurrently-animated VRMs.

## Out of scope

- The actual lobe-vidol npm dependency add (PR-level decision).
- Voice/TTS wiring — follows in a later sub-project.
- Stage assets — only the registry shape is defined here.
- Schema changes to `agent.schema.json` in the home repo — another agent is actively renaming `tier`→`runtime` across those files.

## Follow-up work (captured in the plan)

See `../plans/2026-04-22-vrm-avatars-plan.md`.
