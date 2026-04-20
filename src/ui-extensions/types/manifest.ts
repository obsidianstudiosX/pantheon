/**
 * Pantheon Agent Manifest types — mirror of
 * /opt/obsidian-pantheon/control-plane/manifests/schemas/agent.schema.json (v1.0).
 *
 * Hand-written; keep in sync with the JSON schema. If the schema gains fields,
 * update here and re-run `pnpm exec tsc --noEmit`.
 */

export type RuntimeTier = 'pantheon' | 'openclaw' | 'hermes' | 'sandbox';

export type PhiGuardMode = 'strict' | 'informational' | 'disabled';

export type LifecycleStatus = 'active' | 'archived' | 'experimental' | 'draft';

export type MemoryShard = 'S' | 'M' | 'L' | 'A' | 'X' | 'E' | 'C';

export interface RuntimeManifest {
  tier: RuntimeTier;
  implementation: string;
  implementation_version: string;
  fleet_path: string;
  systemd_unit: string;
  binary: string;
  port?: number;
  transport?: string;
}

export interface CanonManifest {
  source: string;
  character: string;
  outfit?: string | null;
  series?: string | null;
  agency: string;
  role: string;
  emoji?: string | null;
  vibe?: string | null;
}

export interface OrchestrationManifest {
  dispatch_position?: string;
  verify_required: boolean;
  phi_aware: boolean;
  authority_scope?: boolean;
  receives_from?: string[];
  dispatches_to?: string[];
  ratifiers?: string[];
  pipeline_membership: string[];
}

export interface CapabilitiesManifest {
  hook_pipeline: string[];
  owned_skills: string[];
  granted_skills: string[];
  mcp_endpoints?: string[];
}

export interface ModelsManifest {
  primary: string;
  fallback?: string[];
  escalation?: string[];
  provider: string;
  fallback_provider?: string | null;
  temperature?: number;
  max_tokens?: number;
}

export interface PolicyManifest {
  phi_guard_mode: PhiGuardMode;
  review_gate: boolean;
  max_input_tokens?: number;
  max_output_tokens?: number;
  allowed_platforms: string[];
  blocked_platforms?: string[];
  cost_ceiling_daily_usd?: number;
  policy_bundle_refs?: string[];
}

export interface MemoryManifest {
  shards: MemoryShard[];
  acl?: Record<string, unknown>;
  local_path: string;
  per_turn_retrieval?: boolean;
  retrieval_top_k?: number;
  kb_bindings?: string[];
}

export interface MatrixManifest {
  identity: string;
  identities?: string[];
  primary_room?: string;
  audit_room?: string;
}

export interface ShellManifest {
  category?: string;
  tags?: string[];
  marketplace_published?: boolean;
  related_agents?: string[];
  system_prompt: string;
  opening_message?: string;
  opening_questions?: string[];
}

export interface LifecycleManifest {
  status: LifecycleStatus;
  created_at: string;
  last_persona_edit?: string;
  version: string;
  created_by?: string;
  last_edited_by?: string;
  clinical_signoff_refs?: string[];
}

export interface AgentManifest {
  schema_version: string;
  slug: string;
  display_name: string;
  description: string;
  avatar?: string | null;
  vrm?: string | null;
  runtime: RuntimeManifest;
  canon: CanonManifest;
  orchestration: OrchestrationManifest;
  capabilities: CapabilitiesManifest;
  models: ModelsManifest;
  policy: PolicyManifest;
  memory: MemoryManifest;
  matrix: MatrixManifest;
  shell: ShellManifest;
  lifecycle: LifecycleManifest;
  extensions: Record<string, unknown>;
}

// Sibling manifests (shape-only; expand when schemas land in control-plane)

export interface SkillManifest {
  schema_version: string;
  slug: string;
  display_name: string;
  description: string;
  owner: string;
  tier?: RuntimeTier;
  required_scopes?: string[];
  implementation?: string;
}

export interface ProviderManifest {
  schema_version: string;
  slug: string;
  display_name: string;
  kind: 'llm' | 'mcp' | 'skill-host' | 'storage' | string;
  endpoint?: string;
  credentials_ref?: string;
  models?: string[];
}

export interface PolicyBundle {
  schema_version: string;
  slug: string;
  display_name: string;
  description: string;
  phi_guard_mode?: PhiGuardMode;
  rules?: Record<string, unknown>[];
}

export interface PipelineManifest {
  schema_version: string;
  slug: string;
  display_name: string;
  members: string[];
  dispatch_order?: string[];
  ratifiers?: string[];
}
