import { index, integer, jsonb, pgTable, text } from 'drizzle-orm/pg-core';

import { idGenerator } from '../utils/idGenerator';
import { timestamps, timestamptz } from './_helpers';
import { users } from './user';

/**
 * Pantheon Chart Review — PHI-gated clinical chart review queue.
 *
 * Operator submits raw chart text; `detectPhi` from the PHI guard scans it.
 * If the pipeline is running in strict mode AND PHI is detected, the text
 * lands here in `pending` status rather than being dispatched to the LLM.
 * Operator reviews, redacts, approves, then explicitly dispatches to a
 * clinical agent (typically `teresse-clinical` on port 18818).
 *
 * Status flow:
 *   pending   -> submitted, PHI detected, awaiting operator scrub
 *   approved  -> scrubbed, ready to dispatch (or auto-approved when no PHI)
 *   dispatched -> sent to clinical agent; result row exists
 *   rejected  -> operator declined / withdrew
 *
 * Separate table from `pantheon_kanban_cards` because the data model is
 * fundamentally different (PHI scan metadata, scrub history, result row).
 */
export const pantheonChartReviewQueue = pgTable(
  'pantheon_chart_review_queue',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => idGenerator('pantheonChartReviewQueue'))
      .notNull(),

    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),

    // Raw chart text as submitted. NEVER dispatched as-is when PHI was
    // detected in strict mode — operator must provide redactedText.
    submittedText: text('submitted_text').notNull(),

    // List of PHI pattern names that matched (output of `detectPhi`).
    // jsonb for flexibility if we later add match offsets.
    phiTypes: jsonb('phi_types').$type<string[]>().default([]).notNull(),

    // 'pending' | 'approved' | 'dispatched' | 'rejected'
    status: text('status').notNull().default('pending'),

    // Operator-provided scrubbed text. Populated on approve(); this is what
    // ultimately gets dispatched to the clinical agent.
    redactedText: text('redacted_text'),

    // Target agent id from the Pantheon registry (e.g. 'teresse-clinical').
    // NOT a foreign key to `agents` because the clinical fleet lives in a
    // separate registry.json; operator types the agent_id string.
    agentId: text('agent_id'),

    // Free-form operator note on reject (and optionally on approve).
    rejectReason: text('reject_reason'),

    // When the queue item was actually dispatched to the clinical agent.
    dispatchedAt: timestamptz('dispatched_at'),

    ...timestamps,
  },
  (t) => [
    index('pantheon_chart_review_queue_user_id_idx').on(t.userId),
    index('pantheon_chart_review_queue_status_idx').on(t.status),
  ],
);

export type NewPantheonChartReviewQueueItem =
  typeof pantheonChartReviewQueue.$inferInsert;
export type PantheonChartReviewQueueItem = typeof pantheonChartReviewQueue.$inferSelect;

/**
 * Response row from the clinical agent. One-to-one with a queue item
 * (a redispatch would create a second row — history preserved).
 */
export const pantheonChartReviewResults = pgTable(
  'pantheon_chart_review_results',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => idGenerator('pantheonChartReviewResults'))
      .notNull(),

    queueItemId: text('queue_item_id')
      .references(() => pantheonChartReviewQueue.id, { onDelete: 'cascade' })
      .notNull(),

    // Full assistant response text (possibly multi-paragraph clinical note).
    response: text('response').notNull(),

    tokensIn: integer('tokens_in'),
    tokensOut: integer('tokens_out'),
    latencyMs: integer('latency_ms'),

    // createdAt only — results are immutable once written.
    createdAt: timestamps.createdAt,
  },
  (t) => [
    index('pantheon_chart_review_results_queue_item_id_idx').on(t.queueItemId),
  ],
);

export type NewPantheonChartReviewResult = typeof pantheonChartReviewResults.$inferInsert;
export type PantheonChartReviewResultItem = typeof pantheonChartReviewResults.$inferSelect;
