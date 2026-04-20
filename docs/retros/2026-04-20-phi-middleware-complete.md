# PHI Middleware Sub-Project Retro (2026-04-20)

## What landed (sub-project #2, 8 commits across pantheon home repo)

- `c89a70a` feat(systemd): pantheon-phi-middleware.service + fleet-target wiring
- `ef05657` feat(mcp-catalog): register phi-middleware on port 18895
- `e71af28` docs(phi-middleware): setup + troubleshooting guide
- `9ad2bcf` spec(phi-middleware): v2 reconcile with actual hooks.py API
- `cebf551` fix(mcp-catalog): align phi-middleware advertised_tools with v2
- `c1bb923` feat(phi-middleware): MCP server v2 — 4 primitives + 2 envelope tools
- `999e691` test(phi-middleware): Python primitive parity 108/108
- `6766699` test(phi-middleware): MCP roundtrip 3/3
- `fdca1c9` fix(systemd): drop User/Group for user-session install

## Verification

- Python primitive parity: 108/108 passed (0.09s)
- MCP roundtrip: 3/3 passed (0.65s)
- TS fixture regression: 108/108 passed (LobeHub chat path unchanged)
- Service: active, listening on 127.0.0.1:18895
- Clinical re-cert: signed 2026-04-20 per auto-approval directive

## What surprised me

1. **Spec v1 had significant API drift.** Subagent α correctly escalated NEEDS_CONTEXT rather than guess. Key drifts: `TurnEnvelope.agent_id` not `agent_slug`, `phi_types` not `phi_types_found`, `review_required` + `phi_guard_mode` pattern instead of a `blocked` flag, fixture file is mono-JSON at `/opt/obsidian-pantheon/tests/phi-fixtures.json` with `phi_fixtures` / `credential_fixtures` / `refusal_fixtures` keys, FastMCP is `mcp.server.fastmcp` not `fastmcp` standalone. Spec v2 reconciled all these. Lesson: for wrapper sub-projects, the spec MUST read the wrapped module's actual signatures before specifying the wrapper's API.

2. **Systemd User/Group kills user-session units.** Lifted the pattern from existing system-level services; user-session rejects explicit User=/Group= with "Failed to determine supplementary groups: Operation not permitted" (status=216/GROUP). Removing them fixes it. Worth propagating this to any other user-session units we write.

3. **Redis fallback path worked seamlessly.** Redis was unreachable in the test environment; the in-memory envelope store kicked in transparently per design. No test failures.

4. **MCP session init handshake needed for roundtrip tests.** Subagent α implemented a proper `MCPSession` class (initialize + notifications/initialized) rather than falling back to a reduced test scope. Clean instrumentation worth preserving.

## What the next session should check first

- **Sub-project #2.5 (Filesystem Consolidation)** — operator surfaced concern about naming collisions between runtime/openclaw (custom) and real OpenClaw. Propose rename + fleet/ hierarchy + archive of legacy ~/agents/ dupes.
- **Sub-project #3 (Gateway)** — now unblocked. Gateway will be the FIRST consumer of the MCP middleware via the cross-runtime path.
- Verify Redis reachability before Gateway goes live (currently in-memory fallback is hiding a potential production issue for envelope state persistence across server restarts).

## Blockers resolved during execution

- **Plan-code drift** → spec v2 inline reconciliation + redispatch with explicit API. Took one extra iteration but caught the issue before any wrong code got written.
- **Catalog advertised_tools mismatch** → patched in `cebf551` when v2 surfaced; took ~2 min.
- **Systemd User/Group issue** → patched in `fdca1c9`; took ~5 min.

No unresolved blockers.
