import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { getAgentById } from '@/config/pantheon/registry';
import { ChartReviewModel } from '@/database/models/pantheon/chart-review';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import { detectPhi } from '@/server/pantheon/hooks/phi-guard';

const chartReviewProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;
  return opts.next({
    ctx: {
      chartReviewModel: new ChartReviewModel(ctx.serverDB, ctx.userId),
    },
  });
});

const statusEnum = z.enum(['pending', 'approved', 'dispatched', 'rejected']);

/**
 * chartReview tRPC router.
 *
 * Endpoints:
 *   - submit:    run detectPhi on user text, enqueue with status
 *                auto-approved / pending depending on PHI + strict mode.
 *   - listQueue: fetch queue items, optionally filtered by status.
 *   - get:       fetch one item + its results.
 *   - approve:   save redactedText, mark approved.
 *   - reject:    mark rejected with optional reason.
 *   - dispatch:  post redactedText to the clinical fleet agent; store result.
 *   - detectPhi: pure helper exposed so the UI can highlight PHI client-side
 *                without re-implementing the regex set.
 */
export const chartReviewRouter = router({
  approve: chartReviewProcedure
    .input(
      z.object({
        id: z.string(),
        redactedText: z.string().min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const updated = await ctx.chartReviewModel.approve(input.id, input.redactedText);
      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Chart review item not found' });
      }
      return updated;
    }),

  detectPhi: chartReviewProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => {
      return { phiTypes: detectPhi(input.text) };
    }),

  dispatch: chartReviewProcedure
    .input(
      z.object({
        agentId: z.string().min(1),
        id: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const agent = getAgentById(input.agentId);
      if (!agent) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Unknown clinical agent: ${input.agentId}`,
        });
      }
      if (!process.env.PANTHEON_FLEET_TOKEN) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message:
            'PANTHEON_FLEET_TOKEN is not configured on this server — dispatch is disabled.',
        });
      }
      try {
        return await ctx.chartReviewModel.dispatch(input.id, {
          agentId: input.agentId,
          port: agent.port,
        });
      } catch (error) {
        console.error('[pantheon.chartReview.dispatch]', error);
        throw new TRPCError({
          cause: error,
          code: 'INTERNAL_SERVER_ERROR',
          message:
            error instanceof Error ? error.message : 'Chart review dispatch failed',
        });
      }
    }),

  get: chartReviewProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const item = await ctx.chartReviewModel.get(input.id);
      if (!item) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Chart review item not found' });
      }
      const results = await ctx.chartReviewModel.getResults(item.id);
      return { item, results };
    }),

  listQueue: chartReviewProcedure
    .input(z.object({ status: statusEnum.optional() }).optional())
    .query(async ({ input, ctx }) => {
      return ctx.chartReviewModel.listQueue(input?.status);
    }),

  reject: chartReviewProcedure
    .input(
      z.object({
        id: z.string(),
        reason: z.string().max(1024).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const updated = await ctx.chartReviewModel.reject(input.id, input.reason);
      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Chart review item not found' });
      }
      return updated;
    }),

  submit: chartReviewProcedure
    .input(
      z.object({
        strictMode: z.boolean().optional(),
        userText: z.string().min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const phiTypes = detectPhi(input.userText);
      try {
        return await ctx.chartReviewModel.submit({
          phiTypes,
          strictMode: input.strictMode,
          userText: input.userText,
        });
      } catch (error) {
        console.error('[pantheon.chartReview.submit]', error);
        throw new TRPCError({
          cause: error,
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to submit chart for review',
        });
      }
    }),
});

export type ChartReviewRouter = typeof chartReviewRouter;
