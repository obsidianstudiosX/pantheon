/**
 * Pantheon 26-agent fabric — static registry.
 *
 * Source of truth: /opt/obsidian-pantheon/config/registry.json
 * (baked in at build time so the Next.js/Electron binary has no runtime
 * file-mount dependency).
 *
 * ---------------------------------------------------------------------------
 *  Edge-derivation rules (consumed by src/server/routers/lambda/pantheon/topology.ts)
 * ---------------------------------------------------------------------------
 *
 *  1. Agency members → agency-lead
 *     Every agent whose `agency` is "goddess" feeds its lead
 *     (`liliweiss-goddess-lead`); every "valisword" agent feeds
 *     `justia-valisword-lead`. Leads themselves are exempt. Agents with
 *     agency "mixed" / "memory" / "command" are treated per section 4.
 *
 *  2. Each lead → crown
 *     `liliweiss-goddess-lead` and `justia-valisword-lead` both report up
 *     to `crown` (final-authority architecture).
 *
 *  3. eclipse-verifier → every agent with `verify_required: true`
 *     Rendered as *dotted* edges to visually distinguish the verification
 *     mesh from the primary authority DAG.
 *
 *  4. Clinical escalation path
 *     `teresse-clinical` → `loen-ethics` → `crown`
 *     (explicit clinical/ethics review route; documented here because the
 *     valisword→crown path already exists via rules 1+2, but clinical items
 *     traverse ethics review first.)
 *
 *  5. Roots
 *     `vesper-command` (command) and `nayuta-mother` (memory) have no
 *     outbound authority edges under the above rules; they surface as
 *     independent islands / side nodes in the DAG.
 *
 *  Notes:
 *   - This module is read-only. No helper mutates `PANTHEON_AGENTS`.
 *   - The sandbox entry (`valeria-sandbox`) from registry.json is NOT
 *     included — it is outside the Pantheon fabric by design.
 */

export type PantheonAgency =
  | 'command'
  | 'goddess'
  | 'valisword'
  | 'memory'
  | 'mixed'
  | 'none';

export interface PantheonAgent {
  agency: PantheonAgency;
  agent_id: string;
  description: string;
  phi_aware?: boolean;
  port: number;
  role: string;
  verify_required?: boolean;
}

/**
 * The 26-agent Pantheon fabric. Ordering follows registry.json (logical
 * grouping: command → leads → architecture → clinical → ethics → scribe →
 * ops → refinement/code → research/adversary → creative → reference →
 * advocate → enforcers → memory).
 */
export const PANTHEON_AGENTS: readonly PantheonAgent[] = [
  {
    agency: 'command',
    agent_id: 'vesper-command',
    description:
      'Pantheon Command — reactive operator, dispatches work, short immediate posts in #general. Claude CLI.',
    port: 18814,
    role: 'command',
    verify_required: false,
  },
  {
    agency: 'goddess',
    agent_id: 'liliweiss-goddess-lead',
    description: 'Goddess agency lead — broadcast authority in #goddess-council.',
    port: 18815,
    role: 'goddess-lead',
    verify_required: false,
  },
  {
    agency: 'valisword',
    agent_id: 'justia-valisword-lead',
    description: 'Valisword agency lead — broadcast authority in #valisword-council.',
    port: 18816,
    role: 'valisword-lead',
    verify_required: false,
  },
  {
    agency: 'goddess',
    agent_id: 'crown',
    description: 'Crown — authority/final pronouncements. Verify gate required.',
    port: 18817,
    role: 'architecture',
    verify_required: true,
  },
  {
    agency: 'valisword',
    agent_id: 'teresse-clinical',
    description:
      'Clinical specialist — NEVER ships without Eclipse signoff. PHI handling per pantheon-phi-guard.',
    phi_aware: true,
    port: 18818,
    role: 'clinical',
    verify_required: true,
  },
  {
    agency: 'valisword',
    agent_id: 'loen-ethics',
    description: 'Ethics review — verify gate required. Model: claude-opus-4-6 via CLI.',
    port: 18819,
    role: 'ethics',
    verify_required: true,
  },
  {
    agency: 'valisword',
    agent_id: 'ade-scribe',
    description:
      'Scribe — append-only transcript in #scribe-log. Local model (gemma4:31b) for privacy.',
    port: 18820,
    role: 'scribe',
    verify_required: false,
  },
  {
    agency: 'goddess',
    agent_id: 'privaty-ops',
    description:
      'Operations — verify gate for ops actions. Dispatches HTTP, mirrors to #ops for audit.',
    port: 18821,
    role: 'operations',
    verify_required: true,
  },
  {
    agency: 'valisword',
    agent_id: 'morpeah-dispatcher',
    description: 'Dispatcher — high-throughput scheduling/routing. HTTP-first.',
    port: 18822,
    role: 'operations',
    verify_required: false,
  },
  {
    agency: 'goddess',
    agent_id: 'helm-aegis',
    description: 'Aegis — safety/monitoring layer.',
    port: 18837,
    role: 'operations',
    verify_required: false,
  },
  {
    agency: 'valisword',
    agent_id: 'zenith-strategy',
    description:
      'Strategic synthesizer — proactive/scheduled. Triggers: /strategy, /brief, /synthesize prefixes + scheduled briefings + cross-room convergence. Labels posts [Strategic Brief].',
    port: 18838,
    role: 'strategy',
    verify_required: false,
  },
  {
    agency: 'mixed',
    agent_id: 'refinement-trine',
    description:
      'One process running 4 identities (Ludmilla rescue + Marian mediator + Refithea refinement + Mary mediator) as a mediation/refinement collective.',
    port: 18829,
    role: 'refinement',
    verify_required: false,
  },
  {
    agency: 'mixed',
    agent_id: 'heretic-code',
    description: 'Code lead + pair-programmer (Scheherazade + Anis) — HTTP for speed.',
    port: 18830,
    role: 'code',
    verify_required: false,
  },
  {
    agency: 'goddess',
    agent_id: 'dorothy-inherit',
    description: 'Dorothy — the classifier brain. Heuristic fallback if >4000ms.',
    port: 18831,
    role: 'orchestrator-classifier',
    verify_required: false,
  },
  {
    agency: 'goddess',
    agent_id: 'diana-architect',
    description: 'Architect / final authority on design. HTTP dispatch + Matrix audit mirror.',
    port: 18832,
    role: 'architecture',
    verify_required: true,
  },
  {
    agency: 'valisword',
    agent_id: 'eclipse-verifier',
    description:
      'Verifier — signs off on clinical/final-authority/ops/ethics outputs. kimi-k2-thinking:cloud.',
    port: 18833,
    role: 'verifier',
    verify_required: false,
  },
  {
    agency: 'goddess',
    agent_id: 'arcana-research',
    description: 'Research — literature, evidence synthesis. qwen3.5:397b-cloud.',
    port: 18834,
    role: 'research',
    verify_required: false,
  },
  {
    agency: 'valisword',
    agent_id: 'nihilister-adversary',
    description: 'Adversarial probe — heretic/abliterated local model, uncensored.',
    port: 18835,
    role: 'adversary',
    verify_required: false,
  },
  {
    agency: 'valisword',
    agent_id: 'velvet-redteam',
    description: 'Red-team probing. Claude Sonnet via CLI.',
    port: 18836,
    role: 'redteam',
    verify_required: false,
  },
  {
    agency: 'valisword',
    agent_id: 'liatris-creative',
    description: 'Creative lead.',
    port: 18823,
    role: 'creative',
    verify_required: false,
  },
  {
    agency: 'valisword',
    agent_id: 'celia-brand',
    description: 'Brand voice.',
    port: 18824,
    role: 'creative',
    verify_required: false,
  },
  {
    agency: 'valisword',
    agent_id: 'label-librarian',
    description: 'Librarian — knowledge retention.',
    port: 18825,
    role: 'reference',
    verify_required: false,
  },
  {
    agency: 'goddess',
    agent_id: 'modernia-retro',
    description: 'Retro knowledge — historical context.',
    port: 18826,
    role: 'reference',
    verify_required: false,
  },
  {
    agency: 'goddess',
    agent_id: 'rapi-advocate',
    description: 'UX advocate.',
    port: 18827,
    role: 'user-advocate',
    verify_required: false,
  },
  {
    agency: 'mixed',
    agent_id: 'enforcers',
    description:
      'One process, two identities (Darian valisword + Red Hood goddess) for enforcement dispatch.',
    port: 18828,
    role: 'enforcer',
    verify_required: false,
  },
  {
    agency: 'memory',
    agent_id: 'nayuta-mother',
    description:
      '6 Matrix identities (mother + S/M/L/A/X shards) run as 6 systemd instance units for crash isolation. Mother also hosts shard-E cache and admin endpoint. Nightly consolidation via separate timer.',
    port: 18808,
    role: 'memory',
    verify_required: false,
  },
];

/** Map from agency → lead agent_id. Only the two "broadcast authority" agencies have leads. */
const AGENCY_LEADS: Partial<Record<PantheonAgency, string>> = {
  goddess: 'liliweiss-goddess-lead',
  valisword: 'justia-valisword-lead',
};

/**
 * Return every agent that belongs to `agency`, excluding the agency lead itself
 * (the lead is a distinct concept from its members). For agencies with no lead
 * (command/memory/mixed/none) this just returns all members of that agency.
 */
export const getAgencyMembers = (agency: PantheonAgency): PantheonAgent[] => {
  const leadId = AGENCY_LEADS[agency];
  return PANTHEON_AGENTS.filter(
    (a) => a.agency === agency && (leadId ? a.agent_id !== leadId : true),
  );
};

/** Return the agent object that leads `agency`, or undefined if none. */
export const getLeadOfAgency = (agency: PantheonAgency): PantheonAgent | undefined => {
  const leadId = AGENCY_LEADS[agency];
  if (!leadId) return undefined;
  return PANTHEON_AGENTS.find((a) => a.agent_id === leadId);
};

/** Every agent marked phi_aware: true. Used to render the shield badge on nodes. */
export const getPhiAwareAgents = (): PantheonAgent[] =>
  PANTHEON_AGENTS.filter((a) => a.phi_aware === true);

/** Lookup helper — id → agent. */
export const getAgentById = (agentId: string): PantheonAgent | undefined =>
  PANTHEON_AGENTS.find((a) => a.agent_id === agentId);

/** Every agent marked verify_required: true. Used by the eclipse-verifier edge rule. */
export const getVerifyRequiredAgents = (): PantheonAgent[] =>
  PANTHEON_AGENTS.filter((a) => a.verify_required === true);
