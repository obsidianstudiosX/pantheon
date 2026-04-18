import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { SnapshotModel } from '@/database/models/pantheon/snapshots';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';

const snapshotsProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;
  return opts.next({
    ctx: {
      snapshotModel: new SnapshotModel(ctx.serverDB, ctx.userId),
    },
  });
});

export const snapshotsRouter = router({
  capture: snapshotsProcedure
    .input(
      z.object({
        agentId: z.string().min(1),
        label: z.string().min(1).max(255),
        parentSnapshotId: z.string().optional().nullable(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        return await ctx.snapshotModel.capture(
          input.agentId,
          input.label,
          input.parentSnapshotId ?? null,
        );
      } catch (error) {
        console.error('[pantheon.snapshots.capture]', error);
        throw new TRPCError({
          cause: error,
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to capture agent snapshot',
        });
      }
    }),

  delete: snapshotsProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const ok = await ctx.snapshotModel.delete(input.id);
      if (!ok) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Snapshot not found' });
      }
      return { success: true };
    }),

  diff: snapshotsProcedure
    .input(z.object({ aId: z.string(), bId: z.string() }))
    .query(async ({ input, ctx }) => {
      try {
        return await ctx.snapshotModel.diff(input.aId, input.bId);
      } catch (error) {
        console.error('[pantheon.snapshots.diff]', error);
        throw new TRPCError({
          cause: error,
          code: 'NOT_FOUND',
          message: 'Failed to diff snapshots',
        });
      }
    }),

  list: snapshotsProcedure
    .input(z.object({ agentId: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      return ctx.snapshotModel.list(input.agentId);
    }),

  restore: snapshotsProcedure
    .input(z.object({ snapshotId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      try {
        return await ctx.snapshotModel.restore(input.snapshotId);
      } catch (error) {
        console.error('[pantheon.snapshots.restore]', error);
        throw new TRPCError({
          cause: error,
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to restore snapshot',
        });
      }
    }),
});

export type SnapshotsRouter = typeof snapshotsRouter;
