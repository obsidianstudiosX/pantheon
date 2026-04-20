# Platform Consolidation Sub-Project Retro (2026-04-20)

## What landed (7 waves, 10 commits across 2 repos)

**Home repo (`obsidianstudiosX/obsidian-pantheon`, branch `main`):**

- `8790e2a` spec(architecture): Pantheon platform architecture v3 — definitive
- `d9f180f` spec(architecture): lock 4 decisions at top of v3 spec (pantheon-py identity, shell/vendor/overlay asymmetry, manifest authority, DB contract)
- `32c4766` feat(control-plane): bootstrap 26 agent manifests from current state **\[Wave A1]**
- `17fc748` feat(vendor): canonical vendor tree at `/opt/obsidian-pantheon/vendor/` **\[Wave A2]**
- `29d984e` docs(overlay): catalog LobeHub fork divergences at `overlay/lobehub/README.md` **\[Wave A4]**
- `6b56daf` feat(fleet): Wave B — runtime-tier reorganization **\[Wave B]**
- `d8cc74a` feat(overlay): consolidate hermes telegram.py patch **\[Wave C]**
- `2ad0000` feat(control-plane): API scaffold v0.1 **\[Wave E]**
- `6ac77c4` feat(control-plane): event bus v0.1 — Postgres LISTEN/NOTIFY **\[Wave F]**

**Fork repo (`obsidianstudiosX/pantheon`, branch `pantheon-main`):**

- `741c35fd` feat(db): Pantheon extension tables for control-plane state **\[Wave D]**
- `69c70e83` docs(claude-md): add rules for platform architecture
- `1bb0ec93` feat(ui-extensions): 8 panels scaffold + RuntimePanel end-to-end **\[Wave G]**

## Architecture delta

Before this sub-project:

- 26 agents lived flat under `agents/<slug>/` (no runtime separation)
- Single `runtime/openclaw/` Python module hosted everything despite name
- No control-plane; registry was a JSON blob
- LobeHub fork divergences were implicit
- PHI pipeline hardcoded in `runtime/openclaw/lib/pantheon/hooks.py`

After:

- **4-tier fleet** by actual runtime: `fleet/pantheon/` (26 agents, our custom runtime), `fleet/openclaw/` (real npm, empty), `fleet/hermes/` (real Nous Hermes, empty), `fleet/sandbox/` (operator-personal, valeria symlinked)
- **First-class control plane** at `control-plane/` with 26 YAML manifests, JSON Schema, aggregated index, validation CLI, HTTP API (port 18790), Postgres LISTEN/NOTIFY event bus, 10 typed events, 2 subscribers
- **Pristine vendor** at `vendor/` (openclaw, hermes-agent, lobehub-upstream); overlays layered via PYTHONPATH/NODE_PATH (runtime-loaded) or catalog metadata (lobehub)
- **8 Pantheon DB extension tables** on the fork's Postgres (agent_ext, memory_shards, agent_memory_bindings, kb_bindings, audit_trail, manifest_events, clinical_signoff_log, user_provider_credentials) — control-plane writes only, never LobeHub
- **8 UI extension panel slots** in shell with Runtime panel fully wired end-to-end; backend proxy at `/api/pantheon/*` routes to control-plane API
- **Non-invasive Valeria move:** `/home/admin-linux/sandbox/valeria-standalone` retained as compat symlink to `/home/admin-linux/standalone/valeria` — HANDS OFF `valeria-sandbox.service` never touched

## Verification

- **Manifests:** 26/26 pass JSON Schema validation; `scripts/validate-manifests.py` emits "All 26 agent manifests validate ✓"
- **Fleet move:** all 26 agents resolve via `fleet/pantheon/<slug>` + compat symlink `agents -> fleet/pantheon`; live fleet services unaffected (running on open FDs)
- **Systemd unit:** `pantheon-agent@.service` paths updated; awaiting operator `daemon-reload`
- **Control-plane API:** 6/6 pytest passes in 0.02s; live curl against 127.0.0.1:18790 returns 26 agents, full Diana manifest, correct 404/501 shapes, manifest/validate 200
- **Event bus:** 12 Python files AST-parse clean; 10 event schemas round-trip validate; integration tests skip pending live DB migration apply
- **UI extensions:** `tsc --noEmit --skipLibCheck` clean on all new files; vitest 2/2 pass (RuntimePanel happy + error); antd v6 Alert migrated to `title` prop
- **Overlay:** telegram.py patch consolidated from 3 divergent Hermes clones (novus canonical); overlay/hermes-agent/ + README catalog in place

## What surprised me

1. **Three of four Hermes clones had the telegram.py patch; `hermes-ref` was pristine.** The earlier audit claimed 4/4 identical — not true. Wave C used novus as canonical patched source and documented `hermes-ref` as the pristine diff base. Lesson: audits that assert "N clones identical" should sha256sum every file, not spot-check.

2. **Drizzle `meta/_journal.json` was corrupted (duplicate idx/tag/when for 100, 102, 103).** Migrations 0100 and 0103 were invisible to Drizzle until the journal was rewritten. Wave D fixed the journal and added 0104–0111 entries. Lesson: sanity-check the journal before adding new migrations.

3. **Wave B's atomic `mv agents/ fleet/pantheon/` + `ln -s fleet/pantheon agents` kept the fleet alive** with zero downtime. Running pantheon-agent@\*.service processes held open FDs on the old inodes; future restarts resolve via symlink. No kill/restart required for the move itself.

4. **Sandbox blocks direct push to default branch even when the task instruction says push.** Waves E and F hit this (same as earlier sub-projects). The task-instruction text is not authorization — operator must grant `Bash(git push origin main:*)` permission or run `! git push origin main` in chat. This is the expected safety behavior; noted so future waves don't treat it as a bug.

5. **psycopg_pool is optional in control-plane API scaffold.** DB handler degrades gracefully when absent or when `PANTHEON_DB_DSN` is unconfigured. Made the scaffold runnable before Wave D migrations hit the live DB.

6. **Overlay's `lobehub/` directory is NOT runtime-loaded**, unlike `overlay/hermes-agent/` and `overlay/openclaw/`. It's catalog metadata documenting divergences between `shell/` (what ships) and `vendor/lobehub-upstream/` (pristine diff base). The asymmetry is deliberate and now encoded in both CLAUDE.md files as Hard Rule 10.

## What the next session should check first

- **Apply Wave D migrations to live DB** — `pnpm drizzle-kit push` or manual `psql -f 0104..0111*.sql` against production. Event bus integration tests auto-skip until this lands.
- **Operator `systemctl --user daemon-reload && systemctl --user restart pantheon-fleet.target`** — picks up new `pantheon-agent@.service` paths.
- **Enable control-plane API unit** — `systemctl --user enable --now pantheon-control-plane-api.service` (listens on 127.0.0.1:18790).
- **Wire UI extension slots into AgentSettingsContent.tsx** — Wave G documented two injection approaches but left the actual tab-level wiring unmerged to avoid LobeHub rebase churn. Operator chooses between (a) new `ChatSettingsTabs.Pantheon` enum tab, or (b) interleaving Pantheon slots inside existing `Meta` tab.
- **Next sub-project candidates:** #4 Runtime migration (populate `fleet/hermes/` and `fleet/openclaw/` with real agents via their respective runtimes), #5 VRM avatars (lobe-vidol integration), #6 Memory evolution (Letta/Zep/Mem0 comparison).

## Blockers resolved during execution

- **Plan-code drift across 26 manifests** → Wave A1 bootstrapped from existing identity.md/soul.md/skills.json/models.json/registry.json rather than drafting fresh. One iteration.
- **Valeria service path pointing at moved dir** → resolved by installing compat symlink; operator-personal unit never edited.
- **Drizzle journal corruption** → rewrote malformed entries during Wave D.
- **Credentials + Qdrant runtime state noise in `git add`** → filtered via pathspec exclusions each commit.
- **Sandbox push block** → flagged to operator; non-fatal (commits sat on local main until authorized).

No unresolved blockers. Waves E+F runtime verification pending live DB migration (operator-gated, low risk — DDL is validated against BEGIN/ROLLBACK tx against a sibling Postgres).
