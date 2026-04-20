# Pantheon Fork — LobeHub Codebase Rules

You are Claude Code working on the Pantheon fork of LobeHub (`obsidianstudiosX/pantheon`, branch `pantheon-main`). This file is loaded every session. Follow these rules.

## Stack

- Next.js 16 (App Router; `proxy.ts` not `middleware.ts`)
- React 19.2, TypeScript 5.x, pnpm workspace
- Drizzle ORM against ParadeDB (postgres:17 + pgvector + pg_search + pg_ivm)
- Better Auth (replaces NextAuth in LobeHub v2)
- Vite for SPA renderer, Electron for desktop, electron-builder for packaging
- Docker Compose stack: pantheon-app, pantheon-postgres, pantheon-redis, pantheon-minio

## Ownership Matrix

| Path                                                   | Owner                   | Edit rule                      |
| ------------------------------------------------------ | ----------------------- | ------------------------------ |
| `src/server/pantheon/**`                               | Clinical (PHI pipeline) | OPERATOR APPROVAL REQUIRED     |
| `src/business/server/pantheon-*`                       | Clinical (wiring)       | OPERATOR APPROVAL REQUIRED     |
| `src/business/server/streaming-credential-redactor.ts` | Clinical                | OPERATOR APPROVAL REQUIRED     |
| `packages/database/migrations/*pantheon*`              | Schema                  | OPERATOR APPROVAL REQUIRED     |
| `packages/database/src/models/pantheon/**`             | Schema                  | OPERATOR APPROVAL REQUIRED     |
| `.env*`, `Dockerfile`, `docker-compose.yml`            | Infra                   | OPERATOR APPROVAL REQUIRED     |
| `src/config/routes/**`                                 | Rebrand-sensitive       | OPERATOR APPROVAL REQUIRED     |
| `src/hooks/useNavLayout.ts`                            | Rebrand-sensitive       | OPERATOR APPROVAL REQUIRED     |
| `packages/business/const/src/branding.ts`              | Rebrand                 | OPERATOR APPROVAL REQUIRED     |
| `apps/desktop/src/main/modules/updater/configs.ts`     | Fork-specific           | OPERATOR APPROVAL REQUIRED     |
| Everything else                                        | Open                    | Follow TDD + line limits below |

## Hard Rules (non-negotiable)

1. **TSC after every TypeScript edit.** Run `pnpm exec tsc --noEmit --skipLibCheck` on the file's package scope. Show output in response. No silent assumptions.
2. **Max 50 lines per bugfix.** If a fix exceeds 50 lines, split into multiple atomic commits. If you CAN'T split, escalate to operator.
3. **One fix per commit.** Atomic history. No "misc cleanup + feature + test" commits.
4. **Verification before completion.** Use the `superpowers:verification-before-completion` skill. Never claim "done" without running the verify command and showing its output in your reply.
5. **No destructive git.** `push --force`, `reset --hard`, `branch -D` against `pantheon-main` or `canary` require explicit operator approval. `--no-verify` for pre-commit hooks requires explicit operator approval (per-invocation, not session-wide).
6. **Clinical-path edits require operator approval.** See ownership matrix above.
7. **Never skip `pnpm install` after pulling.** Workspace package links break silently otherwise.

## Verify commands (run after any change before declaring done)

```bash
# Typecheck (fast)
pnpm exec tsc --noEmit --skipLibCheck 2>&1 | grep "error TS" | wc -l
# Expected: 0

# Pantheon-specific tests
pnpm vitest run src/server/pantheon/hooks/__tests__/ src/business/server/__tests__/ --reporter=dot
# Expected: 121 passed (121)

# PHI fixture gate (pre-existing baseline)
pnpm vitest run src/server/pantheon/hooks/__tests__/fixtures.test.ts --reporter=dot
# Expected: all fixtures green
```

## When in doubt, delegate

- 3+ grep queries in a session → dispatch `Explore` subagent
- Bug investigation → invoke `superpowers:systematic-debugging`
- New feature → invoke `superpowers:test-driven-development`
- Track-parallel work → invoke `superpowers:using-git-worktrees`

## Auto-retro on non-trivial sessions

At session end, if ≥5 tool calls or ≥3 files touched, invoke `remember` skill to write `docs/retros/YYYY-MM-DD-{topic}.md`. Next session's SessionStart hook loads the latest retro.

## References

- Master plan: `/opt/obsidian-pantheon/HANDOFF/UNIFIED-PLAN-2026-04-20.md`
- Pantheon home: `/opt/obsidian-pantheon/`
- Canon registry: `/mnt/c/Users/admin/Downloads/PANTHEON-HANDOFF/RECONCILED-REGISTRY.md`
