#!/usr/bin/env python3
"""Generate packages/model-bank/src/aiModels/pantheon.ts from the home-repo registry.

Reads `/opt/obsidian-pantheon/control-plane/registry/agents.index.json` and emits
the TypeScript model list for the "Pantheon — Direct" provider.

Rules:
  * one AIChatModelCard per agent, id = "pantheon-<slug>".
  * displayName = agent.display_name (falls back to slug) + role-context suffix.
  * contextWindowTokens = 200_000 (inherits underlying Claude Opus context).
  * If the registry is unreadable the generator prints a warning to stderr and
    emits a single-entry file listing just "pantheon-dispatch" so the LobeHub
    build doesn't break; the dispatch provider file handles its own registration.

Regenerate whenever the agent roster changes:
  python3 scripts/generate-pantheon-models.py > packages/model-bank/src/aiModels/pantheon.ts

Spec: docs/superpowers/specs/2026-04-22-gateway-design.md §D3.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path


DEFAULT_REGISTRY = Path(
    os.environ.get(
        "PANTHEON_REGISTRY",
        "/opt/obsidian-pantheon/control-plane/registry/agents.index.json",
    )
)

# Kept in lockstep with control-plane/gateway/models.py
PHI_STRICT_SLUGS = frozenset({"teresse-clinical", "loen-ethics", "crown"})

HEADER = """// DO NOT EDIT BY HAND.
// Regenerate with: python3 scripts/generate-pantheon-models.py > packages/model-bank/src/aiModels/pantheon.ts
// Source of truth: /opt/obsidian-pantheon/control-plane/registry/agents.index.json
// Spec: docs/superpowers/specs/2026-04-22-gateway-design.md §D3
import type { AIChatModelCard } from '../types/aiModel';

const pantheonChatModels: AIChatModelCard[] = [
"""

FOOTER = """];

export const allModels = [...pantheonChatModels];

export default allModels;
"""

FALLBACK_BODY = """  {
    abilities: { functionCall: true, reasoning: true },
    contextWindowTokens: 200_000,
    description:
      'Fallback entry: agent registry was unreadable at generation time. Regenerate once /opt/obsidian-pantheon/control-plane/registry/agents.index.json is available.',
    displayName: 'Pantheon (Dispatch fallback)',
    enabled: true,
    id: 'pantheon-dispatch',
    maxOutput: 8192,
    type: 'chat',
  },
"""


def _role_suffix(agent: dict) -> str:
    """Human-readable role suffix for the display name (keeps the UI legible)."""
    role = (agent.get("role") or "").strip().replace("-", " ").title()
    return f" ({role})" if role else ""


def _render_agent(agent: dict) -> str:
    slug = agent["slug"]
    display = (agent.get("display_name") or slug).replace("'", "\\'")
    display_with_role = display + _role_suffix(agent)
    phi_strict = slug in PHI_STRICT_SLUGS
    status = (agent.get("status") or "active").lower()
    enabled = "true" if status == "active" else "false"
    # Every agent-facing turn can call tools and reason; LobeHub uses these flags
    # to show badges/UI affordances. Keep conservative but not empty.
    lines = [
        "  {",
        "    abilities: { functionCall: true, reasoning: true },",
        "    contextWindowTokens: 200_000,",
        f"    description: 'Pantheon agent ({slug}). "
        + ("PHI-strict (clinical pipeline)." if phi_strict else "Direct 1:1 dispatch.")
        + "',",
        f"    displayName: '{display_with_role}',",
        f"    enabled: {enabled},",
        f"    id: 'pantheon-{slug}',",
        "    maxOutput: 8192,",
        "    type: 'chat',",
        "  },",
    ]
    return "\n".join(lines)


def render(registry_path: Path) -> str:
    try:
        with registry_path.open("r", encoding="utf-8") as fh:
            doc = json.load(fh)
    except (OSError, json.JSONDecodeError) as exc:
        print(
            f"warning: could not read {registry_path}: {exc}; emitting fallback.",
            file=sys.stderr,
        )
        return HEADER + FALLBACK_BODY + FOOTER

    agents = doc.get("agents") or []
    if not agents:
        print(
            f"warning: {registry_path} has no agents; emitting fallback.",
            file=sys.stderr,
        )
        return HEADER + FALLBACK_BODY + FOOTER

    sorted_agents = sorted(agents, key=lambda a: a.get("slug", ""))
    body = "\n".join(_render_agent(a) for a in sorted_agents) + "\n"
    return HEADER + body + FOOTER


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--registry",
        default=str(DEFAULT_REGISTRY),
        help="Path to agents.index.json (default: %(default)s)",
    )
    parser.add_argument(
        "--out",
        default=None,
        help="Write output to this file (UTF-8, LF line endings). Default: stdout.",
    )
    args = parser.parse_args(argv)
    content = render(Path(args.registry))
    if args.out:
        out_path = Path(args.out)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with out_path.open("w", encoding="utf-8", newline="\n") as fh:
            fh.write(content)
    else:
        # Ensure deterministic UTF-8 output regardless of host locale.
        try:
            sys.stdout.reconfigure(encoding="utf-8", newline="\n")  # type: ignore[attr-defined]
        except AttributeError:
            pass
        sys.stdout.write(content)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
