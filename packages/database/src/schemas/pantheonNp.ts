import { index, integer, jsonb, pgTable, text } from 'drizzle-orm/pg-core';

import { idGenerator } from '../utils/idGenerator';
import { timestamps, varchar255 } from './_helpers';
import { users } from './user';

/**
 * Pantheon NP — Nurse Practitioner zone.
 *
 * Three-tab operator surface: DB-backed submissions, iframe-embedded portal
 * (no schema — pure UI), and a curated Resource Hub of external links.
 *
 * PHI-safety: submissions store only `patientInitials` (never full names) and a
 * free-text body the operator chooses to enter. Caller surfaces route content
 * through existing Pantheon PHI scrubbers before persisting if needed.
 */

/** Submission-tracking ledger. One row per external-form/case/referral. */
export const pantheonNpSubmissions = pgTable(
  'pantheon_np_submissions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => idGenerator('pantheonNpSubmissions'))
      .notNull(),

    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),

    title: varchar255('title').notNull(),

    // Initials only — NEVER full patient names. UI enforces <= 8 chars.
    patientInitials: text('patient_initials'),

    submittedBy: varchar255('submitted_by'),

    submissionText: text('submission_text'),

    // 'draft' | 'submitted' | 'completed'
    status: text('status').notNull().default('draft'),

    // External tracker ID (e.g. portal case ID).
    externalTrackingId: varchar255('external_tracking_id'),

    metadata: jsonb('metadata').default({}),

    ...timestamps,
  },
  (t) => [
    index('pantheon_np_submissions_user_id_idx').on(t.userId),
    index('pantheon_np_submissions_status_idx').on(t.status),
  ],
);

export type NewPantheonNpSubmission = typeof pantheonNpSubmissions.$inferInsert;
export type PantheonNpSubmissionItem = typeof pantheonNpSubmissions.$inferSelect;

/** Resource Hub — curated external-link collection. */
export const pantheonNpResources = pgTable(
  'pantheon_np_resources',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => idGenerator('pantheonNpResources'))
      .notNull(),

    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),

    title: varchar255('title').notNull(),
    url: text('url').notNull(),
    description: text('description'),

    // Free-form tags (e.g. ["clinical", "guideline"]).
    tags: jsonb('tags').default([]),

    // Lower sortOrder = higher in list.
    sortOrder: integer('sort_order').default(0),

    createdBy: varchar255('created_by'),

    ...timestamps,
  },
  (t) => [
    index('pantheon_np_resources_user_id_idx').on(t.userId),
    index('pantheon_np_resources_sort_idx').on(t.sortOrder),
  ],
);

export type NewPantheonNpResource = typeof pantheonNpResources.$inferInsert;
export type PantheonNpResourceItem = typeof pantheonNpResources.$inferSelect;
