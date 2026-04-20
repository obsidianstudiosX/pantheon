# Runtime Migration Sub-Project Retro (2026-04-22)

Sub-project #4: tier-aware runtime dispatch + 2 pilot migrations (arcana-research → OpenClaw, liatris-creative → Hermes).

## What landed (14 tasks, 14 commits across 2 repos)

**Home repo (`obsidianstudiosX/obsidian-pantheon`, branch `main`):**

Pilot scaffold (Tasks 1–4):

- `e1bcdf4` feat(runtime-migration): tier-aware dispatcher + arcana-research openclaw pilot **\[T1+T2+T3+T4 combined scaffold]**
- `7e70b66` fix(manifests): correct tier to pantheon for 24 non-pilot agents **\[T2 data fix]**
- `a23c5e6` chore: +x on runtime-dispatch scripts **\[T3 permissions]**

Adapters + projector (Tasks 5–9):

- `c5427aa` feat(adapters): common projection helpers (manifest slice, persona split, service.env) **\[T5]**
- `323298b` feat(adapters): pantheon tier projector — byte-identical to v0.1 output **\[T6]**
- `3c554e9` feat(adapters): openclaw tier projector — openclaw-config.yaml + Matrix channel **\[T7]**
- `0abf459` feat(adapters): hermes tier projector — cli-config.yaml + self-improving skills scaffold **\[T8]**
- `dc4a571` feat(events): real tier-aware projector — dispatches to pantheon/openclaw/hermes adapters **\[T9]**

Drop-ins + base unit (Tasks 10–11):

- `3cef9d6` feat(systemd): per-agent drop-in generator + 26 drop-ins for tier-aware paths **\[T10]**
- `0b9e6a9` feat(systemd): base unit tier-agnostic — dispatch via runtime-dispatch.sh + drop-ins **\[T11]**

Pilots (Tasks 12–13):

- `2ca672c` feat(pilot): arcana-research OpenClaw full projection via tier adapter **\[T12]**
- `e34ed87` feat(pilot): liatris-creative Hermes full projection **\[T13]**
- `2ecb563` fix(pilot): add arcana-research adapter outputs that 2ca672c missed **\[T12 follow-up]**

Task 14 (verification + archive fix) will land alongside this retro on home: one plan-log entry commit + one archive-move commit.

**Fork repo (`obsidianstudiosX/pantheon`, branch `pantheon-main`):**

- This retro.

## Architecture delta

| Aspect              | Before sub-project #4                                                              | After sub-project #4                                                                                                                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `runtime.tier` enum | `{openclaw, hermes, sandbox}` — `pantheon` rejected by schema                      | `{pantheon, openclaw, hermes, sandbox}` — matches D1 locked decision                                                                                                                                    |
| Manifest truth      | 26/26 said `tier: openclaw` regardless of physical location                        | 24 say `pantheon`, 1 `openclaw` (arcana), 1 `hermes` (liatris); Valeria stays `sandbox`                                                                                                                 |
| Systemd base unit   | Hardcoded `ExecStart=/opt/obsidian-pantheon/runtimes/pantheon-py/bin/agent-run %i` | Tier-agnostic — `ExecStart=/opt/obsidian-pantheon/scripts/runtime-dispatch.sh %i`; per-agent drop-ins inject tier-specific `RT=`, `FLEET_DIR=`, `EnvironmentFile=`                                      |
| Dispatcher          | None — single implicit path                                                        | `scripts/runtime-dispatch.sh` reads manifest, resolves binary + config path per tier, supports `PANTHEON_DISPATCH_DRY_RUN=1` for tests                                                                  |
| Projection adapters | Single `project_agent.py` inside events subscriber, pantheon-only                  | Three tier adapters (`control-plane/adapters/{pantheon,openclaw,hermes}/project_agent.py`) + shared `common.py`; event subscriber dispatches by `manifest.runtime.tier`                                 |
| Fleet layout        | All 26 under `fleet/pantheon/`                                                     | 24 under `fleet/pantheon/`, 1 under `fleet/openclaw/arcana-research/`, 1 under `fleet/hermes/liatris-creative/`; old pantheon-tier dirs archived to `state/archive/fleet/pantheon/<slug>/` on tier move |
| Drop-ins            | None                                                                               | 26 files at `systemd/drop-ins/pantheon-agent@<slug>.service.d/tier.conf`, regeneratable via `scripts/project-systemd-dropin.py`                                                                         |
| Tier-change archive | Manual                                                                             | Adapter helper `archive_existing_fleet_dir()` moves old tier dir into `state/archive/fleet/<old-tier>/<slug>/`; `.gitignore` updated to keep archive out of day-to-day diffs except on explicit moves   |
| Idempotency         | Signature file existed for pantheon only                                           | `.projected.sha` signature on every tier's adapter output; projector refuses to clobber hand-edits unless `force=True`                                                                                  |

**Live pilots:** arcana-research now has full OpenClaw shape (`agent/openclaw-config.yaml`, `agent/manifest.json`, persona, `runtime/service.env`, `runtime/skills.d/`, `workspace/`). Liatris-creative has full Hermes shape (`agent/cli-config.yaml` with `gateway.platforms.matrix`, provider-map from `claude-cli` → `anthropic` and `ollama-cloud` → `custom`, `memory.mode=local`, self-improving skills auto-create block). Neither is started — operator owns service install + smoke.

## Verification

Exit codes captured 2026-04-22 during Task 14:

| Suite                                                   | Count          | Result                                       |
| ------------------------------------------------------- | -------------- | -------------------------------------------- |
| `control-plane/api/tests/`                              | 31             | 31 passed in 1.21s (exit 0)                  |
| `control-plane/events/tests/test_manifest_projector.py` | 8              | 8 passed in 0.16s (exit 0)                   |
| `control-plane/adapters/tests/`                         | 52             | 52 passed in 0.18s (exit 0)                  |
| `scripts/tests/test_project_systemd_dropin.py`          | 5              | 5 passed in 0.22s (exit 0)                   |
| `scripts/test-runtime-dispatch.sh`                      | 9              | 9/9 passed (exit 0)                          |
| `scripts/validate-manifests.py`                         | 26             | "All 26 agent manifests validate ✓" (exit 0) |
| **Grand total**                                         | **131 checks** | **100% green**                               |

`systemd-analyze verify` on the three representative units: all exit 0 — vesper-command (pantheon tier), arcana-research (openclaw tier), liatris-creative (hermes tier).

Projection sanity:

- `fleet/pantheon/` — 24 agent dirs + `_config` (matches spec after stale-arcana archive move).
- `fleet/openclaw/arcana-research/` — full shape present (`agent/`, `runtime/`, `workspace/`, `registry.json`).
- `fleet/hermes/liatris-creative/` — full shape present.
- `state/archive/fleet/pantheon/liatris-creative/` and `state/archive/fleet/pantheon/arcana-research/` — archived trees present.
- `systemd/drop-ins/pantheon-agent@*.service.d/tier.conf` — 26 files (24 pantheon + 1 openclaw + 1 hermes).

Idempotency: `scripts/project-systemd-dropin.py` second run wrote 0 files, `git diff --stat systemd/drop-ins/` empty. Openclaw adapter re-projection into tmp dir diffed byte-identical against `fleet/openclaw/arcana-research/` after fixing a lone CRLF contamination in `registry.json` (see surprise #3). Hermes adapter re-projection byte-identical against `fleet/hermes/liatris-creative/` on first try.

Live control-plane API sanity (port 18790): the service was `inactive (dead)` at verification time — last stopped 17:18 per journal. Briefing disallowed restarting (preserves uptime guarantee), so the 4 API checks were performed against the manifest layer directly: `count=26`, `arcana-research.runtime.tier=openclaw`, `liatris-creative.runtime.tier=hermes`, `diana-architect.runtime.tier=pantheon`. Flagging to operator — service needs a restart before the emitter can resume publishing `agent.*` events.

## What surprised me

1. **Git rename detection forgot the old pantheon-tier dir for arcana-research.** The plan spec said "Do NOT delete old fleet dirs on tier change — archive them," and the pilot-scaffold commit (`e1bcdf4`) installed the new `fleet/openclaw/arcana-research/` tree but never moved the legacy `fleet/pantheon/arcana-research/` out. Liatris-creative _did_ get archived correctly by the same adapter's `archive_existing_fleet_dir()` helper. Root cause: arcana's pantheon-tier dir had been committed in the Wave B fleet reorganization (`6b56daf`) well before the adapter existed, so when task 12 ran the adapter, the adapter didn't know the pantheon-tier inhabitant was its own prior self. The adapter's archive logic keys on "old tier's fleet dir present when new tier is different" — but at arcana's first projection, the manifest tier was already `openclaw`, so from the adapter's perspective there was no "old tier" to archive. Fixed during Task 14 via `git mv fleet/pantheon/arcana-research state/archive/fleet/pantheon/arcana-research`. Lesson: when introducing tier-change semantics after the fact, the first-time projection of an already-moved agent needs a one-shot migration pass that's separate from the steady-state tier-change hook.

2. **Hermes `cli-config.yaml` has considerably more surface area than the minimal plan shape suggests.** The plan spec described `cli-config.yaml` as "Hermes CLI config — roughly identity, provider map, gateway platforms." In practice the adapter also has to emit a `memory.mode=local` block (Hermes refuses to boot without it), a `skills.auto_create` flag for the self-improving skills scaffold, and a provider-map rule that maps `claude-cli` → `anthropic` (Hermes's provider enum doesn't include `claude-cli`). `ollama-cloud` → `custom` was another surprise — Hermes's built-in enum doesn't know about the Ollama cloud tenant, so we pipe it through the generic `custom` provider with the right endpoint envs. Had to add 7 unit tests (`test_hermes_adapter.py::test_cli_config_*`) covering each of these knobs.

3. **Windows UNC mount silently rewrote one file with CRLF.** `fleet/openclaw/arcana-research/registry.json` was committed in `2ca672c` with CRLF line endings even though the adapter writes LF unconditionally via `Path.write_text(..., newline='\n')` (verified by re-projecting into a tmp dir on Linux-native filesystem — byte-identical minus the CRLF). The contamination almost certainly came from an editor saving via the `\\wsl.localhost\Ubuntu\...` UNC path while Git autocrlf was in effect on the Windows side. Caught during the adapter idempotency byte-check (the tmp-dir re-projection diff showed the _same content_ but 194 vs 185 bytes). Fixed in place with a 4-line Python normalizer. Lesson: cross-OS authorship of adapter outputs needs a pre-commit hook that re-projects & rejects any byte drift, otherwise a single drive-by Windows save can make "idempotent" no longer idempotent.

4. **The `.projected.sha` clobber-guard did exactly what it was supposed to — including when I didn't want it to.** When I tried to force-rewrite arcana's CRLF-contaminated `registry.json` via `project_agent(..., force=True)`, the adapter returned `projected: 0` because the signature matched (the file's _content_ as computed by the canonical-manifest hash was still valid — only the line-endings had drifted). This is correct behavior but surprising in a debugging context: `force=True` skips hand-edit protection, not signature matching. Had to normalize the file directly. Good signal that the adapter is conservative; also a reminder to document the three levels of protection explicitly in the adapter docstring: (1) hand-edit guard, (2) signature match, (3) manifest-hash match.

5. **`runtime/service.env` gitignore split.** `.gitignore` was updated in Task 4 to exclude `state/archive/fleet/` but also ended up excluding `fleet/*/service.env` — deliberately, because the file holds agent-specific local envs (ports, matrix tokens, etc.). This means the adapter's `project_agent` output _includes_ `service.env` but git tracks the template at `runtime/service.env` differently per tier: operator must inject real secrets on the host via a systemd `EnvironmentFile=` drop-in, not by committing. Documented in the task-12/13 commit bodies. Caught during the byte-equality diff (had to add `--exclude=service.env` + `--exclude=.env` to the `diff -r` invocation).

## What the next session should check first

- **Restart `pantheon-control-plane-api.service`.** It's currently `inactive (dead)` — the live emitter has been down since 17:18. A clean restart should pick up the new tier-aware projector (`dc4a571`) and resume emitting `agent.updated` / `agent.tier_changed` events.
- **Start arcana-research + liatris-creative under real traffic.** The pilots are _scaffolded_, not _running_. Operator needs to: (a) `systemctl --user daemon-reload` (pickup base-unit change), (b) `systemctl --user enable --now pantheon-agent@arcana-research` + `...@liatris-creative`, (c) watch journal for OpenClaw/Hermes startup errors, (d) smoke-test a message through Matrix on each. Expect provider-map + matrix-room-id drift on first contact.
- **Populate the other 24 fleet/pantheon dirs via the projector on each `agent.updated` event.** Today only the 2 pilots have adapter-generated output under `fleet/<tier>/<slug>/`; the 24 pantheon-tier agents still live off the pre-adapter legacy layout inherited from Wave B. Emit a synthetic `agent.updated` for each non-pilot non-clinical agent and verify the adapter's byte-identical-to-v0.1 invariant holds end-to-end.
- **Decide tier-move policy.** Today a tier change is automatic (adapter archives old tier, projects new tier). For clinical agents this is wrong — tier changes must be operator-gated + re-certification-gated. Add a pre-projection hook in `manifest_projector.py::handle_agent_updated` that checks `manifest.orchestration.phi_aware` and refuses if true unless a `PANTHEON_OPERATOR_TIER_MOVE_OK=1` env is set.
- **Wire subscribers to do cross-runtime registry writes.** Each tier's adapter writes its own `registry.json` today, but there's no consolidated "which-agent-runs-where" registry. Candidates: extend `control-plane/events/subscribers/` with a `registry_consolidator.py` that tails `agent.tier_changed` and rebuilds `state/registry-by-tier.json`.
- **Add a pre-commit hook that re-projects pilots and rejects byte drift.** Would have caught the CRLF contamination at commit time (surprise #3).

## Blockers resolved during execution

- **Sandbox blocks direct push to default branch.** Same constraint as platform-consolidation retro #5. Pilot commits sat on local `main` until operator ran `git push origin main`. Non-fatal, expected, documented here for consistency.
- **Drop-in `.service.d/tier.conf` exec-bit.** Early drafts of `scripts/project-systemd-dropin.py` wrote drop-ins as `0755`; systemd silently ignores drop-ins with unexpected modes. Fixed to `0644` in the generator (`a23c5e6` covers the adjacent scripts +x fix that was conflated in the initial commit).
- **Parallel-writer git races.** During the adapter wave (Tasks 5–9), multiple adapter test suites wrote to overlapping tmp-dir paths inside a shared `pytest-asyncio` loop. Two runs raced on `.projected.sha` writes, leaving the signature file truncated and failing `test_project_idempotent`. Fixed by scoping each test's `fleet_root=` to an isolated `tempfile.TemporaryDirectory()` and removing the shared fixture. Non-flaky since.
- **Diana's manifest tier was `openclaw` post-Wave-B** (a Wave-B oversight — the reorganization physically moved Diana but didn't re-derive the manifest tier). Corrected by `7e70b66` along with the other 23 agents; schema fix in `e1bcdf4` made the corrections actually validatable.

No unresolved blockers. Operator actions queued above are all non-blocking and fail safely if skipped (pilots stay offline, legacy pantheon-tier layout remains byte-identical to pre-migration).
