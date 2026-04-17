import { and, asc, eq } from 'drizzle-orm';

import { pantheonKanbanCards } from '../../schemas';
import type { PantheonKanbanCardItem } from '../../schemas/pantheonKanban';
import type { LobeChatDatabase } from '../../type';

export interface KanbanCreateInput {
  agentId?: string | null;
  columnOrder?: number;
  description?: string | null;
  metadata?: Record<string, unknown>;
  priority?: number;
  status?: 'backlog' | 'in-progress' | 'done';
  title: string;
}

export interface KanbanUpdateInput {
  agentId?: string | null;
  columnOrder?: number;
  description?: string | null;
  metadata?: Record<string, unknown>;
  priority?: number;
  status?: 'backlog' | 'in-progress' | 'done';
  title?: string;
}

/**
 * KanbanModel — persistence for the Pantheon Work Rail.
 *
 * All queries are tenant-isolated by userId; callers should never trust a raw
 * input.id without the model scoping the `where` clause to this.userId.
 */
export class KanbanModel {
  private readonly userId: string;
  private readonly db: LobeChatDatabase;

  constructor(db: LobeChatDatabase, userId: string) {
    this.db = db;
    this.userId = userId;
  }

  async list(agentId?: string): Promise<PantheonKanbanCardItem[]> {
    const conditions = [eq(pantheonKanbanCards.userId, this.userId)];
    if (agentId) conditions.push(eq(pantheonKanbanCards.agentId, agentId));

    return this.db
      .select()
      .from(pantheonKanbanCards)
      .where(and(...conditions))
      .orderBy(asc(pantheonKanbanCards.columnOrder), asc(pantheonKanbanCards.createdAt));
  }

  async create(input: KanbanCreateInput): Promise<PantheonKanbanCardItem> {
    const [row] = await this.db
      .insert(pantheonKanbanCards)
      .values({
        agentId: input.agentId ?? null,
        columnOrder: input.columnOrder ?? 0,
        description: input.description ?? null,
        metadata: input.metadata ?? {},
        priority: input.priority ?? 0,
        status: input.status ?? 'backlog',
        title: input.title,
        userId: this.userId,
      })
      .returning();

    return row;
  }

  async update(
    cardId: string,
    input: KanbanUpdateInput,
  ): Promise<PantheonKanbanCardItem | null> {
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined) patch.description = input.description;
    if (input.status !== undefined) patch.status = input.status;
    if (input.priority !== undefined) patch.priority = input.priority;
    if (input.columnOrder !== undefined) patch.columnOrder = input.columnOrder;
    if (input.agentId !== undefined) patch.agentId = input.agentId;
    if (input.metadata !== undefined) patch.metadata = input.metadata;

    const rows = await this.db
      .update(pantheonKanbanCards)
      .set(patch)
      .where(
        and(eq(pantheonKanbanCards.id, cardId), eq(pantheonKanbanCards.userId, this.userId)),
      )
      .returning();

    return rows[0] ?? null;
  }

  async delete(cardId: string): Promise<boolean> {
    const rows = await this.db
      .delete(pantheonKanbanCards)
      .where(
        and(eq(pantheonKanbanCards.id, cardId), eq(pantheonKanbanCards.userId, this.userId)),
      )
      .returning({ id: pantheonKanbanCards.id });

    return rows.length > 0;
  }
}
