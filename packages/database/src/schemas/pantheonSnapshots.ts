import { index, jsonb, pgTable, text } from 'drizzle-orm/pg-core';

import { idGenerator } from '../utils/idGenerator';
import { timestamps, varchar255 } from './_helpers';
import { agents } from './agent';
import { users } from './user';

/**
 * Pantheon Agent Snapshots — operator-facing capture/restore/diff of agent
 * configuration (system prompt, model, provider, tools, etc.).
 *
 * Freezes an agent's current config as a named, immutable record. Supports
 * "safe edits" workflows — capture a snapshot before a risky change, then
 * restore if something breaks. Distinct from LobeHub's `agents` table which
 * holds the live config; these rows are historical copies.
 *
 * Uses the `pantheon_` table prefix and `psn` id prefix to stay in the
 * private-fork namespace alongside `pantheon_kanban_cards`.
 */
export const pantheonAgentSnapshots = pgTable(
  'pantheon_agent_snapshots',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => idGenerator('pantheonAgentSnapshots'))
      .notNull(),

    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),

    agentId: text('agent_id')
      .references(() => agents.id, { onDelete: 'cascade' })
      .notNull(),

    label: varchar255('label').notNull(),

    // Frozen copy of the agent config at capture time — system prompt, model,
    // provider, tools, chat config, params, etc. Stored as jsonb so callers
    // can diff field-by-field.
    config: jsonb('config').notNull().default({}),

    // Optional lineage pointer — if this snapshot was derived from another
    // (e.g. restored and re-captured), track the parent for the diff UI.
    parentSnapshotId: text('parent_snapshot_id'),

    ...timestamps,
  },
  (t) => [
    index('pantheon_agent_snapshots_user_id_idx').on(t.userId),
    index('pantheon_agent_snapshots_agent_id_idx').on(t.agentId),
    index('pantheon_agent_snapshots_user_agent_idx').on(t.userId, t.agentId),
  ],
);

export type NewPantheonAgentSnapshot = typeof pantheonAgentSnapshots.$inferInsert;
export type PantheonAgentSnapshotItem = typeof pantheonAgentSnapshots.$inferSelect;
