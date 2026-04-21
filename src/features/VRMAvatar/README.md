# VRMAvatar

Per-agent 3D portrait component for sub-project #5. Driven by the `vrm`
field on the agent manifest and resolved server-side via
`/api/avatar/<slug>` (a thin wrapper over `server/resolver.ts`).

**Status: scaffold complete + all safe shell-side plan tasks landed.** The
actual three.js / @pixiv/three-vrm / lobe-vidol integration is gated on
operator approval of the npm deps; the exact plug-in point is in
`components/Scene.tsx`.

## Directory layout

| File                               | Purpose                                                                                                                                                                                                        |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.tsx`                        | `<VRMAvatar agentSlug size idle variant forcePlaceholder />` + `<VRMAvatarChip>` — the public surface. Wraps `<Scene>` behind `React.lazy`, IntersectionObserver, reduced-motion, and the 2-concurrent cap.    |
| `types.ts`                         | `VRMBinding`, `VRMBindingRaw`, `VRMResolveResponse`.                                                                                                                                                           |
| `normalise.ts`                     | `normaliseVrmBinding(raw)` collapses the three wire shapes (string / null / object) to a single camelCase `VRMBinding`.                                                                                        |
| `stages.ts`                        | `STAGE_REGISTRY` of Matrix-room-alias → background URL. `resolveStageUrl(aliasOrUrl)` handles the manifest-override case.                                                                                      |
| `concurrency.ts`                   | Process-wide 2-slot cap for animated scenes (design §6). `useVRMSlot(id, wanted)`.                                                                                                                             |
| `components/Scene.tsx`             | Lazy-loaded mount point. **The only file that will import `three` + `@pixiv/three-vrm`.** Today renders a static placeholder visual + stage background; the three-vrm wiring plugs in at `mountThreeVrmScene`. |
| `hooks/useVRMBinding.ts`           | react-query hook. Hits `/api/pantheon/v1/agents/<slug>/vrm`; soft-falls-back to a mock catalog when the control plane is unreachable.                                                                          |
| `hooks/useInViewport.ts`           | IntersectionObserver wrapper with 256 px rootMargin.                                                                                                                                                           |
| `hooks/usePrefersReducedMotion.ts` | MediaQueryList wrapper; `true` forces a static (non-animated) scene.                                                                                                                                           |
| `server/resolver.ts`               | Shared server-side resolver used by the API route. Handles static-mode, manifest fetch, and MinIO signing.                                                                                                     |
| `__tests__/*.test.{ts,tsx}`        | 32 tests across normaliser, stages, resolver, concurrency, hooks, component.                                                                                                                                   |

## Environment flags

- `NEXT_PUBLIC_VRM_AVATARS=1` — show the chip next to the chat-header topic
  title. Disabled by default so the fork ships benign.
- `NEXT_PUBLIC_VRM_RESOLVER=static` — the resolver returns
  `/branding/vrm/<slug>.vrm` directly (no control-plane, no MinIO). Useful
  for local dev and integration tests.
- `PANTHEON_VRM_BUCKET`, `PANTHEON_MINIO_ENDPOINT`,
  `PANTHEON_MINIO_ACCESS_KEY`, `PANTHEON_MINIO_SECRET_KEY`,
  `PANTHEON_MINIO_REGION` — MinIO signing parameters.
- `PANTHEON_CONTROL_PLANE_URL` — default `http://127.0.0.1:18790`.

## Plug-in points for the real VRM runtime

When `@pixiv/three-vrm` and `three` are approved as deps:

1. **`components/Scene.tsx`** — replace the body of `mountThreeVrmScene` per
   the block comment (GLTFLoader + VRMLoaderPlugin + render loop). The
   outer component shape already supports `idle`, `staticFrame`, `size`,
   and `binding`.
2. **`hooks/useVRMBinding.ts`** — no changes required; already hits the
   real resolver.
3. **`package.json`** — operator adds the deps and runs `pnpm install`.

Nothing else needs to change once the deps land.

## Consumer notes

- `<VRMAvatar agentSlug size={96}>` — default for ChatHeader-sized
  portraits. Auto-degrades off-viewport.
- `<VRMAvatarChip agentSlug size={40}>` — small form for mentions, chat
  bubbles, group avatars. Internally renders `<VRMAvatar variant="chip">`.
- `forcePlaceholder` — agent-select grid should set `true` on off-hover
  tiles to stay under the concurrency cap.

## See also

- Design spec: `docs/superpowers/specs/2026-04-22-vrm-avatars-design.md`
- Plan: `docs/superpowers/plans/2026-04-22-vrm-avatars-plan.md`
- Agent manifest schema (home repo, read-only for this fork):
  `control-plane/manifests/schemas/agent.schema.json` — `vrm` is still
  `string | null`. Object-form upgrade is plan Task 1 and lives there.
