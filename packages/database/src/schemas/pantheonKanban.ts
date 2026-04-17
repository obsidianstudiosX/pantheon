import { index, integer, jsonb, pgTable, text } from 'drizzle-orm/pg-core';

import { idGenerator } from '../utils/idGenerator';
import { timestamps, varchar255 } from './_helpers';
import { agents } from './agent';
import { users } from './user';

/**
 * Pantheon Work Rail — operator-facing kanban board.
 *
 * Distinct from LobeHub's agent-facing `tasks` table. This is for humans
 * planning/tracking work items (Backlog -> In Progress -> Done). The
 * `pantheon_` table prefix and `pkc` id prefix reserve namespace for the
 * broader Pantheon feature suite (topology, snapshots, chart-review, np).
 */
export const pantheonKanbanCards = pgTable(
  'pantheon_kanban_cards',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => idGenerator('pantheonKanbanCards'))
      .notNull(),

    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),

    // Optional association with an agent (e.g. which agent owns the work).
    agentId: text('agent_id').references(() => agents.id, { onDelete: 'set null' }),

    title: varchar255('title').notNull(),
    description: text('description'),

    // 'backlog' | 'in-progress' | 'done'
    status: text('status').notNull().default('backlog'),

    // 0-3 (higher = more urgent). Kept as int for flexibility.
    priority: integer('priority').default(0),

    // Sort order within a column (lower = higher in list).
    columnOrder: integer('column_order').default(0),

    metadata: jsonb('metadata').default({}),

    ...timestamps,
  },
  (t) => [
    index('pantheon_kanban_cards_user_id_idx').on(t.userId),
    index('pantheon_kanban_cards_agent_id_idx').on(t.agentId),
    index('pantheon_kanban_cards_status_idx').on(t.status),
  ],
);

export type NewPantheonKanbanCard = typeof pantheonKanbanCards.$inferInsert;
export type PantheonKanbanCardItem = typeof pantheonKanbanCards.$inferSelect;
