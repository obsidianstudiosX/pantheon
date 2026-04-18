import { and, desc, eq } from 'drizzle-orm';

import { agents, pantheonAgentSnapshots } from '../../schemas';
import type { PantheonAgentSnapshotItem } from '../../schemas/pantheonSnapshots';
import type { LobeChatDatabase } from '../../type';

/**
 * Shape of the agent config captured in a snapshot. Mirrors the subset of
 * fields on `agents` that an operator cares about freezing — system prompt,
 * model, provider, plugins (tools), chat config, params.
 */
export interface SnapshotConfig {
  chatConfig?: unknown;
  model?: string | null;
  openingMessage?: string | null;
  openingQuestions?: string[] | null;
  params?: unknown;
  plugins?: string[] | null;
  provider?: string | null;
  systemRole?: string | null;
  tts?: unknown;
  [key: string]: unknown;
}

export interface SnapshotDiffResult {
  added: string[];
  changed: Array<{ after: unknown; before: unknown; field: string }>;
  removed: string[];
}

/**
 * Shallow JSON diff between two config objects. Keys only on `a` are
 * "removed", keys only on `b` are "added", keys on both with different
 * serialized values are "changed". Serialization uses JSON.stringify for a
 * stable-ish comparison — sufficient for operator review, not intended as a
 * cryptographic fingerprint.
 */
const shallowDiff = (
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): SnapshotDiffResult => {
  const added: string[] = [];
  const removed: string[] = [];
  const changed: Array<{ after: unknown; before: unknown; field: string }> = [];

  const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  for (const key of keys) {
    const hasA = a && Object.prototype.hasOwnProperty.call(a, key);
    const hasB = b && Object.prototype.hasOwnProperty.call(b, key);
    if (hasA && !hasB) {
      removed.push(key);
    } else if (!hasA && hasB) {
      added.push(key);
    } else if (hasA && hasB) {
      const va = (a as Record<string, unknown>)[key];
      const vb = (b as Record<string, unknown>)[key];
      if (JSON.stringify(va) !== JSON.stringify(vb)) {
        changed.push({ after: vb, before: va, field: key });
      }
    }
  }

  return { added: added.sort(), changed, removed: removed.sort() };
};

/**
 * SnapshotModel — persistence for Pantheon agent-config snapshots.
 *
 * All queries are tenant-isolated by userId. `capture` reads the live agent
 * row and freezes the relevant fields into a jsonb `config`; `restore`
 * writes the frozen config back onto the agent row (same userId guard).
 */
export class SnapshotModel {
  private readonly userId: string;
  private readonly db: LobeChatDatabase;

  constructor(db: LobeChatDatabase, userId: string) {
    this.db = db;
    this.userId = userId;
  }

  /** List snapshots for an agent, newest first. */
  async list(agentId: string): Promise<PantheonAgentSnapshotItem[]> {
    return this.db
      .select()
      .from(pantheonAgentSnapshots)
      .where(
        and(
          eq(pantheonAgentSnapshots.userId, this.userId),
          eq(pantheonAgentSnapshots.agentId, agentId),
        ),
      )
      .orderBy(desc(pantheonAgentSnapshots.createdAt));
  }

  /**
   * Capture the current live config of `agentId` as a new snapshot.
   * Throws if the agent is not owned by this user.
   */
  async capture(
    agentId: string,
    label: string,
    parentSnapshotId?: string | null,
  ): Promise<PantheonAgentSnapshotItem> {
    const [agent] = await this.db
      .select({
        chatConfig: agents.chatConfig,
        model: agents.model,
        openingMessage: agents.openingMessage,
        openingQuestions: agents.openingQuestions,
        params: agents.params,
        plugins: agents.plugins,
        provider: agents.provider,
        systemRole: agents.systemRole,
        tts: agents.tts,
      })
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.userId, this.userId)))
      .limit(1);

    if (!agent) {
      throw new Error(`Agent not found or not owned by user: ${agentId}`);
    }

    const config: SnapshotConfig = {
      chatConfig: agent.chatConfig ?? null,
      model: agent.model ?? null,
      openingMessage: agent.openingMessage ?? null,
      openingQuestions: agent.openingQuestions ?? null,
      params: agent.params ?? null,
      plugins: agent.plugins ?? null,
      provider: agent.provider ?? null,
      systemRole: agent.systemRole ?? null,
      tts: agent.tts ?? null,
    };

    const [row] = await this.db
      .insert(pantheonAgentSnapshots)
      .values({
        agentId,
        config,
        label,
        parentSnapshotId: parentSnapshotId ?? null,
        userId: this.userId,
      })
      .returning();

    return row;
  }

  /**
   * Restore an agent to the frozen config of a snapshot. Returns the restored
   * snapshot row so the caller can surface metadata.
   */
  async restore(snapshotId: string): Promise<PantheonAgentSnapshotItem> {
    const [snapshot] = await this.db
      .select()
      .from(pantheonAgentSnapshots)
      .where(
        and(
          eq(pantheonAgentSnapshots.id, snapshotId),
          eq(pantheonAgentSnapshots.userId, this.userId),
        ),
      )
      .limit(1);

    if (!snapshot) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }

    const cfg = (snapshot.config ?? {}) as SnapshotConfig;

    await this.db
      .update(agents)
      .set({
        chatConfig: (cfg.chatConfig ?? null) as typeof agents.$inferInsert.chatConfig,
        model: (cfg.model ?? null) as string | null,
        openingMessage: (cfg.openingMessage ?? null) as string | null,
        openingQuestions: (cfg.openingQuestions ?? null) as string[] | null,
        params: (cfg.params ?? {}) as typeof agents.$inferInsert.params,
        plugins: (cfg.plugins ?? null) as string[] | null,
        provider: (cfg.provider ?? null) as string | null,
        systemRole: (cfg.systemRole ?? null) as string | null,
        tts: (cfg.tts ?? null) as typeof agents.$inferInsert.tts,
        updatedAt: new Date(),
      })
      .where(and(eq(agents.id, snapshot.agentId), eq(agents.userId, this.userId)));

    return snapshot;
  }

  /**
   * Shallow JSON diff of two snapshots. Both snapshots must be owned by this
   * user. Returned shape is `{ added, removed, changed }` — added keys exist
   * only in `b`, removed exist only in `a`, changed exist in both with a
   * different JSON serialization.
   */
  async diff(aId: string, bId: string): Promise<SnapshotDiffResult> {
    const rows = await this.db
      .select()
      .from(pantheonAgentSnapshots)
      .where(
        and(
          eq(pantheonAgentSnapshots.userId, this.userId),
          // inArray would be cleaner but we keep the query simple — two lookups
          // are fine for this low-volume path.
        ),
      );

    const byId = new Map(rows.map((r) => [r.id, r]));
    const a = byId.get(aId);
    const b = byId.get(bId);
    if (!a || !b) {
      throw new Error('One or both snapshots not found');
    }

    return shallowDiff(
      (a.config ?? {}) as Record<string, unknown>,
      (b.config ?? {}) as Record<string, unknown>,
    );
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.db
      .delete(pantheonAgentSnapshots)
      .where(
        and(
          eq(pantheonAgentSnapshots.id, id),
          eq(pantheonAgentSnapshots.userId, this.userId),
        ),
      )
      .returning({ id: pantheonAgentSnapshots.id });

    return rows.length > 0;
  }
}
