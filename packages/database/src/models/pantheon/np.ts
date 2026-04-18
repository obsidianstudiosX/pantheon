import { and, asc, desc, eq } from 'drizzle-orm';

import { pantheonNpResources, pantheonNpSubmissions } from '../../schemas';
import type { PantheonNpResourceItem, PantheonNpSubmissionItem } from '../../schemas/pantheonNp';
import type { LobeChatDatabase } from '../../type';

// -- Submissions -------------------------------------------------------------

export type NPSubmissionStatus = 'draft' | 'submitted' | 'completed';

export interface NPSubmissionCreateInput {
  externalTrackingId?: string | null;
  metadata?: Record<string, unknown>;
  patientInitials?: string | null;
  status?: NPSubmissionStatus;
  submissionText?: string | null;
  submittedBy?: string | null;
  title: string;
}

export interface NPSubmissionUpdateInput {
  externalTrackingId?: string | null;
  metadata?: Record<string, unknown>;
  patientInitials?: string | null;
  status?: NPSubmissionStatus;
  submissionText?: string | null;
  submittedBy?: string | null;
  title?: string;
}

/**
 * NPSubmissionModel — tenant-isolated submissions ledger for the Pantheon NP
 * zone. Every query scopes to this.userId so callers can safely pass raw IDs.
 */
export class NPSubmissionModel {
  private readonly userId: string;
  private readonly db: LobeChatDatabase;

  constructor(db: LobeChatDatabase, userId: string) {
    this.db = db;
    this.userId = userId;
  }

  async list(): Promise<PantheonNpSubmissionItem[]> {
    return this.db
      .select()
      .from(pantheonNpSubmissions)
      .where(eq(pantheonNpSubmissions.userId, this.userId))
      .orderBy(desc(pantheonNpSubmissions.updatedAt));
  }

  async create(input: NPSubmissionCreateInput): Promise<PantheonNpSubmissionItem> {
    const [row] = await this.db
      .insert(pantheonNpSubmissions)
      .values({
        externalTrackingId: input.externalTrackingId ?? null,
        metadata: input.metadata ?? {},
        patientInitials: input.patientInitials ?? null,
        status: input.status ?? 'draft',
        submissionText: input.submissionText ?? null,
        submittedBy: input.submittedBy ?? null,
        title: input.title,
        userId: this.userId,
      })
      .returning();

    return row;
  }

  async update(
    id: string,
    input: NPSubmissionUpdateInput,
  ): Promise<PantheonNpSubmissionItem | null> {
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (input.title !== undefined) patch.title = input.title;
    if (input.patientInitials !== undefined) patch.patientInitials = input.patientInitials;
    if (input.submittedBy !== undefined) patch.submittedBy = input.submittedBy;
    if (input.submissionText !== undefined) patch.submissionText = input.submissionText;
    if (input.status !== undefined) patch.status = input.status;
    if (input.externalTrackingId !== undefined) patch.externalTrackingId = input.externalTrackingId;
    if (input.metadata !== undefined) patch.metadata = input.metadata;

    const rows = await this.db
      .update(pantheonNpSubmissions)
      .set(patch)
      .where(and(eq(pantheonNpSubmissions.id, id), eq(pantheonNpSubmissions.userId, this.userId)))
      .returning();

    return rows[0] ?? null;
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.db
      .delete(pantheonNpSubmissions)
      .where(and(eq(pantheonNpSubmissions.id, id), eq(pantheonNpSubmissions.userId, this.userId)))
      .returning({ id: pantheonNpSubmissions.id });

    return rows.length > 0;
  }
}

// -- Resources ---------------------------------------------------------------

export interface NPResourceCreateInput {
  createdBy?: string | null;
  description?: string | null;
  sortOrder?: number;
  tags?: string[];
  title: string;
  url: string;
}

export interface NPResourceUpdateInput {
  createdBy?: string | null;
  description?: string | null;
  sortOrder?: number;
  tags?: string[];
  title?: string;
  url?: string;
}

/**
 * NPResourceModel — Resource Hub link collection, tenant-isolated.
 */
export class NPResourceModel {
  private readonly userId: string;
  private readonly db: LobeChatDatabase;

  constructor(db: LobeChatDatabase, userId: string) {
    this.db = db;
    this.userId = userId;
  }

  async list(): Promise<PantheonNpResourceItem[]> {
    return this.db
      .select()
      .from(pantheonNpResources)
      .where(eq(pantheonNpResources.userId, this.userId))
      .orderBy(asc(pantheonNpResources.sortOrder), asc(pantheonNpResources.createdAt));
  }

  async create(input: NPResourceCreateInput): Promise<PantheonNpResourceItem> {
    const [row] = await this.db
      .insert(pantheonNpResources)
      .values({
        createdBy: input.createdBy ?? null,
        description: input.description ?? null,
        sortOrder: input.sortOrder ?? 0,
        tags: input.tags ?? [],
        title: input.title,
        url: input.url,
        userId: this.userId,
      })
      .returning();

    return row;
  }

  async update(id: string, input: NPResourceUpdateInput): Promise<PantheonNpResourceItem | null> {
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (input.title !== undefined) patch.title = input.title;
    if (input.url !== undefined) patch.url = input.url;
    if (input.description !== undefined) patch.description = input.description;
    if (input.tags !== undefined) patch.tags = input.tags;
    if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;
    if (input.createdBy !== undefined) patch.createdBy = input.createdBy;

    const rows = await this.db
      .update(pantheonNpResources)
      .set(patch)
      .where(and(eq(pantheonNpResources.id, id), eq(pantheonNpResources.userId, this.userId)))
      .returning();

    return rows[0] ?? null;
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.db
      .delete(pantheonNpResources)
      .where(and(eq(pantheonNpResources.id, id), eq(pantheonNpResources.userId, this.userId)))
      .returning({ id: pantheonNpResources.id });

    return rows.length > 0;
  }
}
