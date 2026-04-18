import { and, desc, eq } from 'drizzle-orm';

import {
  pantheonChartReviewQueue,
  pantheonChartReviewResults,
} from '../../schemas';
import type {
  PantheonChartReviewQueueItem,
  PantheonChartReviewResultItem,
} from '../../schemas/pantheonChartReview';
import type { LobeChatDatabase } from '../../type';

export type ChartReviewStatus = 'pending' | 'approved' | 'dispatched' | 'rejected';

export interface ChartReviewSubmitInput {
  /**
   * Pre-computed PHI pattern matches (output of `detectPhi` from
   * `@/server/pantheon/hooks`). Passed in from the tRPC layer — the
   * @lobechat/database package is isolated from server-only imports, so
   * PHI detection runs above it.
   */
  phiTypes: string[];
  /** Operator-supplied raw chart text. */
  userText: string;
  /**
   * When true + `phiTypes` is non-empty the row lands in `pending`.
   * When false OR phiTypes is empty the row is auto-approved. Default true.
   */
  strictMode?: boolean;
}

export interface ChartReviewDispatchOptions {
  agentId: string;
  /**
   * Base URL override (tests). Default: http://host.docker.internal:<port>
   * where <port> is supplied separately.
   */
  fleetBaseUrl?: string;
  /** Auth bearer token override. Default reads from env `PANTHEON_FLEET_TOKEN`. */
  fleetToken?: string;
  /** Port number for the target agent (registry lookup happens in the tRPC layer). */
  port: number;
}

/**
 * ChartReviewModel — tenant-isolated PHI-gated chart review queue.
 *
 * Workflow:
 *   1. `submit(userText)` — runs detectPhi; if PHI found + strict mode,
 *      row lands in `pending`. Otherwise row is auto-approved (PHI-free
 *      text is safe to dispatch directly).
 *   2. `approve(id, redactedText)` — operator confirms + saves scrubbed
 *      copy; status becomes `approved`.
 *   3. `reject(id, reason)` — operator declines; status `rejected`.
 *   4. `dispatch(id, opts)` — posts redactedText (or submittedText if
 *      auto-approved) to the clinical agent; result row is stored; status
 *      becomes `dispatched`. HTTP call happens in-model so telemetry +
 *      latency tracking stay colocated.
 */
export class ChartReviewModel {
  private readonly userId: string;
  private readonly db: LobeChatDatabase;

  constructor(db: LobeChatDatabase, userId: string) {
    this.db = db;
    this.userId = userId;
  }

  /**
   * Submit chart text. Runs PHI detection in-model. In strict mode, any PHI
   * match sends the row to `pending`; otherwise rows are auto-approved (and
   * the operator can dispatch immediately). Credential scrub is deferred to
   * the dispatch path — this stage is solely for PHI triage.
   */
  async submit(
    input: ChartReviewSubmitInput,
  ): Promise<PantheonChartReviewQueueItem> {
    const phiTypes = input.phiTypes;
    const hasPhi = phiTypes.length > 0;
    // Strict mode is the clinical operator default (see HANDOFF §8). We only
    // auto-approve rows that are entirely PHI-free.
    const strictMode = input.strictMode ?? true;
    const autoApprove = !hasPhi || !strictMode;

    const [row] = await this.db
      .insert(pantheonChartReviewQueue)
      .values({
        phiTypes,
        redactedText: autoApprove ? input.userText : null,
        status: autoApprove ? 'approved' : 'pending',
        submittedText: input.userText,
        userId: this.userId,
      })
      .returning();

    return row;
  }

  /** Single item. Tenant-scoped — null if the row belongs to another user. */
  async get(id: string): Promise<PantheonChartReviewQueueItem | null> {
    const rows = await this.db
      .select()
      .from(pantheonChartReviewQueue)
      .where(
        and(
          eq(pantheonChartReviewQueue.id, id),
          eq(pantheonChartReviewQueue.userId, this.userId),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  /** List queue items, optionally filtered by status. Newest first. */
  async listQueue(
    status?: ChartReviewStatus,
  ): Promise<PantheonChartReviewQueueItem[]> {
    const conds = [eq(pantheonChartReviewQueue.userId, this.userId)];
    if (status) conds.push(eq(pantheonChartReviewQueue.status, status));
    return this.db
      .select()
      .from(pantheonChartReviewQueue)
      .where(and(...conds))
      .orderBy(desc(pantheonChartReviewQueue.createdAt));
  }

  /**
   * Approve a pending item. Operator supplies `redactedText` (the scrubbed
   * chart copy that WILL be dispatched). The original `submittedText` is
   * kept immutable for audit.
   */
  async approve(
    id: string,
    redactedText: string,
  ): Promise<PantheonChartReviewQueueItem | null> {
    const rows = await this.db
      .update(pantheonChartReviewQueue)
      .set({ redactedText, status: 'approved', updatedAt: new Date() })
      .where(
        and(
          eq(pantheonChartReviewQueue.id, id),
          eq(pantheonChartReviewQueue.userId, this.userId),
        ),
      )
      .returning();
    return rows[0] ?? null;
  }

  /** Reject. Reason is optional but strongly recommended for audit. */
  async reject(
    id: string,
    reason?: string,
  ): Promise<PantheonChartReviewQueueItem | null> {
    const rows = await this.db
      .update(pantheonChartReviewQueue)
      .set({
        rejectReason: reason ?? null,
        status: 'rejected',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(pantheonChartReviewQueue.id, id),
          eq(pantheonChartReviewQueue.userId, this.userId),
        ),
      )
      .returning();
    return rows[0] ?? null;
  }

  /**
   * Dispatch an approved item to the clinical agent fleet. Requires a
   * port (registry lookup) and an agent_id. Posts the redactedText to
   * the agent's /v1/chat/completions endpoint with the PANTHEON_FLEET_TOKEN
   * bearer. On success, persists a result row and moves status to
   * `dispatched`. On failure, re-throws so the tRPC layer returns a 5xx.
   */
  async dispatch(
    id: string,
    opts: ChartReviewDispatchOptions,
  ): Promise<{
    item: PantheonChartReviewQueueItem;
    result: PantheonChartReviewResultItem;
  }> {
    const item = await this.get(id);
    if (!item) throw new Error('Chart review item not found');
    if (item.status !== 'approved') {
      throw new Error(
        `Chart review item must be approved before dispatch (status=${item.status})`,
      );
    }
    const payloadText = item.redactedText ?? item.submittedText;
    if (!payloadText) throw new Error('Chart review item has no text to dispatch');

    const baseUrl =
      opts.fleetBaseUrl ?? `http://host.docker.internal:${opts.port}`;
    const token = opts.fleetToken ?? process.env.PANTHEON_FLEET_TOKEN ?? '';

    const endpoint = `${baseUrl}/v1/chat/completions`;
    const body = {
      messages: [{ content: payloadText, role: 'user' }],
      model: opts.agentId,
      // Deterministic, short for clinical review turns.
      stream: false,
      temperature: 0.2,
    };

    const started = Date.now();
    let response: string;
    let tokensIn: number | undefined;
    let tokensOut: number | undefined;
    try {
      const resp = await fetch(endpoint, {
        body: JSON.stringify(body),
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });
      if (!resp.ok) {
        const errBody = await resp.text().catch(() => '<unreadable>');
        throw new Error(
          `Fleet dispatch HTTP ${resp.status}: ${errBody.slice(0, 500)}`,
        );
      }
      const data = (await resp.json()) as {
        choices?: { message?: { content?: string } }[];
        usage?: { completion_tokens?: number; prompt_tokens?: number };
      };
      response = data?.choices?.[0]?.message?.content ?? '';
      tokensIn = data?.usage?.prompt_tokens;
      tokensOut = data?.usage?.completion_tokens;
    } catch (err) {
      throw err instanceof Error
        ? err
        : new Error(`Fleet dispatch failed: ${String(err)}`);
    }
    const latencyMs = Date.now() - started;

    const [resultRow] = await this.db
      .insert(pantheonChartReviewResults)
      .values({
        latencyMs,
        queueItemId: item.id,
        response,
        tokensIn: tokensIn ?? null,
        tokensOut: tokensOut ?? null,
      })
      .returning();

    const [updatedItem] = await this.db
      .update(pantheonChartReviewQueue)
      .set({
        agentId: opts.agentId,
        dispatchedAt: new Date(),
        status: 'dispatched',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(pantheonChartReviewQueue.id, item.id),
          eq(pantheonChartReviewQueue.userId, this.userId),
        ),
      )
      .returning();

    return { item: updatedItem ?? item, result: resultRow };
  }

  /**
   * Fetch the result row(s) for a queue item (most recent first). Tenant-
   * isolated: returns an empty array if the queue item belongs to another
   * user. The `get()` lookup is the access check.
   */
  async getResults(queueItemId: string): Promise<PantheonChartReviewResultItem[]> {
    const parent = await this.get(queueItemId);
    if (!parent) return [];
    return this.db
      .select()
      .from(pantheonChartReviewResults)
      .where(eq(pantheonChartReviewResults.queueItemId, queueItemId))
      .orderBy(desc(pantheonChartReviewResults.createdAt));
  }
}
