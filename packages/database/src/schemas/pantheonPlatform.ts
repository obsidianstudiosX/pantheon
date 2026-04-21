import {
  bigint,
  bigserial,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { idGenerator } from '../utils/idGenerator';
import { timestamptz, varchar255 } from './_helpers';
import { agents } from './agent';
import { knowledgeBases } from './file';
import { users } from './user';

/**
 * Pantheon Platform — Wave D control-plane state tables.
 *
 * These are the 8 Pantheon extension tables per the platform-architecture
 * spec (2026-04-20 §4c / §6). Source of truth is the control-plane manifest
 * files at `control-plane/manifests/*`; these tables are either caches for
 * UI consumption, append-only audit logs, or shared runtime state.
 */

// ---------------------------------------------------------------------------
// pantheon_agent_ext — 1:1 extension of LobeHub-native `agents`
// ---------------------------------------------------------------------------
export const pantheonAgentExt = pgTable(
  'pantheon_agent_ext',
  {
    agentId: text('agent_id')
      .primaryKey()
      .references(() => agents.id, { onDelete: 'cascade' })
      .notNull(),

    runtimeFamily: text('runtime_family').notNull().default('pantheon'),
    runtimeImplementation: text('runtime_implementation').notNull().default('pantheon-py'),
    runtimeImplementationVersion: varchar('runtime_implementation_version', { length: 32 }),
    fleetPath: text('fleet_path'),
    systemdUnit: varchar255('systemd_unit'),
    binaryPath: text('binary_path'),

    canonSource: varchar('canon_source', { length: 64 }),
    canonCharacter: varchar('canon_character', { length: 128 }),
    canonOutfit: varchar('canon_outfit', { length: 128 }),
    canonAgency: varchar('canon_agency', { length: 32 }),
    canonRole: varchar('canon_role', { length: 64 }),

    dispatchPosition: text('dispatch_position'),
    verifyRequired: boolean('verify_required').notNull().default(false),
    phiAware: boolean('phi_aware').notNull().default(false),
    authorityScope: boolean('authority_scope').notNull().default(false),
    receivesFrom: jsonb('receives_from').$type<string[]>().notNull().default([]),
    dispatchesTo: jsonb('dispatches_to').$type<string[]>().notNull().default([]),
    ratifiers: jsonb('ratifiers').$type<string[]>().notNull().default([]),
    pipelineMembership: jsonb('pipeline_membership').$type<string[]>().notNull().default([]),

    phiGuardMode: text('phi_guard_mode').notNull().default('informational'),
    reviewGate: boolean('review_gate').notNull().default(false),
    maxInputTokens: integer('max_input_tokens'),
    maxOutputTokens: integer('max_output_tokens'),
    allowedPlatforms: jsonb('allowed_platforms').$type<string[]>().notNull().default([]),
    blockedPlatforms: jsonb('blocked_platforms').$type<string[]>().notNull().default([]),
    costCeilingDailyUsd: numeric('cost_ceiling_daily_usd', { precision: 10, scale: 2 }),
    policyBundleRefs: jsonb('policy_bundle_refs').$type<string[]>().notNull().default([]),

    memoryShards: jsonb('memory_shards').$type<string[]>().notNull().default([]),
    memoryLocalPath: text('memory_local_path'),
    memoryPerTurnRetrieval: boolean('memory_per_turn_retrieval').notNull().default(true),
    memoryRetrievalTopK: integer('memory_retrieval_top_k').default(5),

    matrixIdentity: varchar255('matrix_identity'),
    matrixPrimaryRoom: varchar255('matrix_primary_room'),
    matrixAuditRoom: varchar255('matrix_audit_room'),

    status: text('status').notNull().default('active'),
    manifestVersion: varchar('manifest_version', { length: 32 }),
    clinicalSignoffRefs: jsonb('clinical_signoff_refs').$type<string[]>().notNull().default([]),

    manifestSha: varchar('manifest_sha', { length: 64 }),
    manifestLastSyncedAt: timestamptz('manifest_last_synced_at'),

    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('pantheon_agent_ext_runtime_family_idx').on(t.runtimeFamily),
    index('pantheon_agent_ext_phi_guard_mode_idx').on(t.phiGuardMode),
    index('pantheon_agent_ext_status_idx').on(t.status),
    index('pantheon_agent_ext_canon_source_idx').on(t.canonSource),
  ],
);

export type NewPantheonAgentExt = typeof pantheonAgentExt.$inferInsert;
export type PantheonAgentExtItem = typeof pantheonAgentExt.$inferSelect;

// ---------------------------------------------------------------------------
// pantheon_memory_shards — shard catalog (S/M/L/A/X/E/C)
// ---------------------------------------------------------------------------
export const pantheonMemoryShards = pgTable(
  'pantheon_memory_shards',
  {
    shardId: varchar('shard_id', { length: 4 }).primaryKey().notNull(),
    displayName: varchar('display_name', { length: 128 }).notNull(),
    backend: text('backend').notNull(),
    phiSafe: boolean('phi_safe').notNull().default(false),
    ttlDays: integer('ttl_days'),
    description: text('description'),
    config: jsonb('config').notNull().default({}),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('pantheon_memory_shards_backend_idx').on(t.backend),
    index('pantheon_memory_shards_phi_safe_idx').on(t.phiSafe),
  ],
);

export type NewPantheonMemoryShard = typeof pantheonMemoryShards.$inferInsert;
export type PantheonMemoryShardItem = typeof pantheonMemoryShards.$inferSelect;

// ---------------------------------------------------------------------------
// pantheon_agent_memory_bindings — per-agent shard ACL
// ---------------------------------------------------------------------------
export const pantheonAgentMemoryBindings = pgTable(
  'pantheon_agent_memory_bindings',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => idGenerator('pantheonAgentMemoryBindings'))
      .notNull(),

    agentId: text('agent_id')
      .references(() => agents.id, { onDelete: 'cascade' })
      .notNull(),
    shardId: varchar('shard_id', { length: 4 })
      .references(() => pantheonMemoryShards.shardId, { onDelete: 'cascade' })
      .notNull(),

    canRead: boolean('can_read').notNull().default(true),
    canWrite: boolean('can_write').notNull().default(false),

    // 'open' | 'self-only' | 'clinical-only' | 'ratifiers-only' | ...
    aclScope: text('acl_scope').notNull().default('open'),

    retrievalTopK: integer('retrieval_top_k'),
    retrievalMinScore: numeric('retrieval_min_score', { precision: 4, scale: 3 }),

    config: jsonb('config').notNull().default({}),

    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('pantheon_agent_memory_bindings_agent_shard_unique').on(t.agentId, t.shardId),
    index('pantheon_agent_memory_bindings_agent_id_idx').on(t.agentId),
    index('pantheon_agent_memory_bindings_shard_id_idx').on(t.shardId),
  ],
);

export type NewPantheonAgentMemoryBinding = typeof pantheonAgentMemoryBindings.$inferInsert;
export type PantheonAgentMemoryBindingItem = typeof pantheonAgentMemoryBindings.$inferSelect;

// ---------------------------------------------------------------------------
// pantheon_kb_bindings — KB document → (agent, shard) bindings
// ---------------------------------------------------------------------------
export const pantheonKbBindings = pgTable(
  'pantheon_kb_bindings',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => idGenerator('pantheonKbBindings'))
      .notNull(),

    knowledgeBaseId: text('knowledge_base_id').references(() => knowledgeBases.id, {
      onDelete: 'cascade',
    }),
    agentId: text('agent_id').references(() => agents.id, { onDelete: 'cascade' }),
    shardId: varchar('shard_id', { length: 4 }).references(() => pantheonMemoryShards.shardId, {
      onDelete: 'set null',
    }),

    // 'owner' | 'reader' | 'mirror' | 'source-of-truth'
    bindingRole: text('binding_role').notNull().default('reader'),

    config: jsonb('config').notNull().default({}),

    lastIndexedAt: timestamptz('last_indexed_at'),
    indexStatus: text('index_status').notNull().default('pending'),

    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('pantheon_kb_bindings_kb_id_idx').on(t.knowledgeBaseId),
    index('pantheon_kb_bindings_agent_id_idx').on(t.agentId),
    index('pantheon_kb_bindings_shard_id_idx').on(t.shardId),
    index('pantheon_kb_bindings_index_status_idx').on(t.indexStatus),
  ],
);

export type NewPantheonKbBinding = typeof pantheonKbBindings.$inferInsert;
export type PantheonKbBindingItem = typeof pantheonKbBindings.$inferSelect;

// ---------------------------------------------------------------------------
// pantheon_audit_trail — append-only turn audit (HIPAA-ready)
// ---------------------------------------------------------------------------
export const pantheonAuditTrail = pgTable(
  'pantheon_audit_trail',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey().notNull(),

    traceId: uuid('trace_id').notNull(),
    turnId: uuid('turn_id').notNull(),

    agentId: text('agent_id').references(() => agents.id, { onDelete: 'set null' }),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),

    pipeline: varchar('pipeline', { length: 64 }),
    dispatchPosition: text('dispatch_position'),
    role: varchar('role', { length: 64 }),

    eventType: text('event_type').notNull(),
    stakes: varchar('stakes', { length: 32 }),
    phiDetected: boolean('phi_detected').notNull().default(false),
    phiModeActive: text('phi_mode_active'),
    verifyResult: text('verify_result'),
    policyDecision: text('policy_decision'),

    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    costUsd: numeric('cost_usd', { precision: 10, scale: 6 }),

    inputHash: varchar('input_hash', { length: 64 }),
    outputHash: varchar('output_hash', { length: 64 }),
    traceRef: text('trace_ref'),

    metadata: jsonb('metadata').notNull().default({}),

    ts: timestamptz('ts').notNull().defaultNow(),
  },
  (t) => [
    index('pantheon_audit_trail_agent_id_ts_idx').on(t.agentId, t.ts),
    index('pantheon_audit_trail_user_id_ts_idx').on(t.userId, t.ts),
    index('pantheon_audit_trail_trace_id_idx').on(t.traceId),
    index('pantheon_audit_trail_turn_id_idx').on(t.turnId),
    index('pantheon_audit_trail_event_type_idx').on(t.eventType),
    index('pantheon_audit_trail_ts_idx').on(t.ts),
  ],
);

export type NewPantheonAuditTrail = typeof pantheonAuditTrail.$inferInsert;
export type PantheonAuditTrailItem = typeof pantheonAuditTrail.$inferSelect;

// ---------------------------------------------------------------------------
// pantheon_manifest_events + dead_letter — event bus durability
// ---------------------------------------------------------------------------
export const pantheonManifestEvents = pgTable(
  'pantheon_manifest_events',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey().notNull(),
    eventId: uuid('event_id').notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    channel: varchar('channel', { length: 64 }).notNull().default('pantheon_events'),
    schemaVersion: varchar('schema_version', { length: 16 }).notNull().default('1.0'),

    actorUserId: text('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    traceId: uuid('trace_id'),

    agentSlug: varchar('agent_slug', { length: 128 }),
    manifestKind: varchar('manifest_kind', { length: 32 }),

    beforeManifestSha: varchar('before_manifest_sha', { length: 64 }),
    afterManifestSha: varchar('after_manifest_sha', { length: 64 }),

    payload: jsonb('payload').notNull().default({}),

    status: text('status').notNull().default('pending'),
    retryCount: integer('retry_count').notNull().default(0),
    lastError: text('last_error'),

    ts: timestamptz('ts').notNull().defaultNow(),
    processedAt: timestamptz('processed_at'),
  },
  (t) => [
    uniqueIndex('pantheon_manifest_events_event_id_unique').on(t.eventId),
    index('pantheon_manifest_events_name_idx').on(t.name),
    index('pantheon_manifest_events_agent_slug_idx').on(t.agentSlug),
    index('pantheon_manifest_events_status_idx').on(t.status),
    index('pantheon_manifest_events_ts_idx').on(t.ts),
  ],
);

export type NewPantheonManifestEvent = typeof pantheonManifestEvents.$inferInsert;
export type PantheonManifestEventItem = typeof pantheonManifestEvents.$inferSelect;

export const pantheonManifestEventsDeadLetter = pgTable(
  'pantheon_manifest_events_dead_letter',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey().notNull(),
    originalEventId: bigint('original_event_id', { mode: 'bigint' }),
    eventId: uuid('event_id').notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    payload: jsonb('payload').notNull().default({}),
    failureReason: text('failure_reason').notNull(),
    retryCount: integer('retry_count').notNull().default(0),
    firstFailedAt: timestamptz('first_failed_at').notNull().defaultNow(),
    movedAt: timestamptz('moved_at').notNull().defaultNow(),
    resolvedAt: timestamptz('resolved_at'),
    resolvedByUserId: text('resolved_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    resolutionNotes: text('resolution_notes'),
  },
  (t) => [index('pantheon_manifest_events_dl_event_id_idx').on(t.eventId)],
);

export type NewPantheonManifestEventDeadLetter =
  typeof pantheonManifestEventsDeadLetter.$inferInsert;
export type PantheonManifestEventDeadLetterItem =
  typeof pantheonManifestEventsDeadLetter.$inferSelect;

// ---------------------------------------------------------------------------
// pantheon_clinical_signoff_log — immutable cert log
// ---------------------------------------------------------------------------
export const pantheonClinicalSignoffLog = pgTable(
  'pantheon_clinical_signoff_log',
  {
    id: serial('id').primaryKey().notNull(),

    scope: text('scope').notNull(),
    agentId: text('agent_id').references(() => agents.id, { onDelete: 'set null' }),
    pipelineName: varchar('pipeline_name', { length: 128 }),
    policyBundleRef: varchar255('policy_bundle_ref'),

    certDate: date('cert_date').notNull(),
    validFrom: timestamptz('valid_from').notNull().defaultNow(),
    validUntil: timestamptz('valid_until'),
    certVersion: varchar('cert_version', { length: 32 }).notNull(),

    signoffByUserId: text('signoff_by_user_id')
      .references(() => users.id, { onDelete: 'restrict' })
      .notNull(),
    signoffRole: varchar('signoff_role', { length: 64 }).notNull().default('operator'),
    signoffText: text('signoff_text'),
    signoffHash: varchar('signoff_hash', { length: 128 }).notNull(),

    status: text('status').notNull().default('active'),
    revokedAt: timestamptz('revoked_at'),
    revokedByUserId: text('revoked_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    revocationReason: text('revocation_reason'),

    sourceMarkdownPath: text('source_markdown_path'),
    sourceMarkdownSha: varchar('source_markdown_sha', { length: 64 }),

    metadata: jsonb('metadata').notNull().default({}),

    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('pantheon_clinical_signoff_log_agent_id_idx').on(t.agentId),
    index('pantheon_clinical_signoff_log_scope_idx').on(t.scope),
    index('pantheon_clinical_signoff_log_status_idx').on(t.status),
    index('pantheon_clinical_signoff_log_cert_date_idx').on(t.certDate),
  ],
);

export type NewPantheonClinicalSignoff = typeof pantheonClinicalSignoffLog.$inferInsert;
export type PantheonClinicalSignoffItem = typeof pantheonClinicalSignoffLog.$inferSelect;

// ---------------------------------------------------------------------------
// user_provider_credentials — encrypted per-user BYOK storage
// ---------------------------------------------------------------------------
export const userProviderCredentials = pgTable(
  'user_provider_credentials',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => idGenerator('userProviderCredentials'))
      .notNull(),

    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),

    providerName: varchar('provider_name', { length: 64 }).notNull(),

    credentialType: varchar('credential_type', { length: 32 }).notNull().default('api_key'),
    credentialLabel: varchar('credential_label', { length: 128 }),

    encryptedValue: text('encrypted_value').notNull(),
    encryptionScheme: varchar('encryption_scheme', { length: 32 }).notNull().default('aes-256-gcm'),
    encryptionKeyId: varchar('encryption_key_id', { length: 128 }).notNull(),
    iv: varchar('iv', { length: 64 }).notNull(),
    authTag: varchar('auth_tag', { length: 64 }),

    endpointOverride: text('endpoint_override'),
    metadata: jsonb('metadata').notNull().default({}),

    active: boolean('active').notNull().default(true),
    lastUsedAt: timestamptz('last_used_at'),
    rotatedAt: timestamptz('rotated_at'),
    expiresAt: timestamptz('expires_at'),

    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('user_provider_credentials_user_provider_label_unique').on(
      t.userId,
      t.providerName,
      t.credentialLabel,
    ),
    index('user_provider_credentials_user_id_idx').on(t.userId),
    index('user_provider_credentials_provider_name_idx').on(t.providerName),
  ],
);

export type NewUserProviderCredential = typeof userProviderCredentials.$inferInsert;
export type UserProviderCredentialItem = typeof userProviderCredentials.$inferSelect;
