import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { KanbanModel } from '@/database/models/pantheon/kanban';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';

const kanbanProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;
  return opts.next({
    ctx: {
      kanbanModel: new KanbanModel(ctx.serverDB, ctx.userId),
    },
  });
});

const statusEnum = z.enum(['backlog', 'in-progress', 'done']);

const createInput = z.object({
  agentId: z.string().optional().nullable(),
  columnOrder: z.number().int().optional(),
  description: z.string().optional().nullable(),
  priority: z.number().int().min(0).max(3).optional(),
  status: statusEnum.optional(),
  title: z.string().min(1).max(255),
});

const updateInput = z.object({
  id: z.string(),
  agentId: z.string().optional().nullable(),
  columnOrder: z.number().int().optional(),
  description: z.string().optional().nullable(),
  priority: z.number().int().min(0).max(3).optional(),
  status: statusEnum.optional(),
  title: z.string().min(1).max(255).optional(),
});

export const kanbanRouter = router({
  create: kanbanProcedure.input(createInput).mutation(async ({ input, ctx }) => {
    try {
      return await ctx.kanbanModel.create(input);
    } catch (error) {
      console.error('[pantheon.kanban.create]', error);
      throw new TRPCError({
        cause: error,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create kanban card',
      });
    }
  }),

  delete: kanbanProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const ok = await ctx.kanbanModel.delete(input.id);
      if (!ok) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Kanban card not found' });
      }
      return { success: true };
    }),

  list: kanbanProcedure
    .input(z.object({ agentId: z.string().optional() }).optional())
    .query(async ({ input, ctx }) => {
      return ctx.kanbanModel.list(input?.agentId);
    }),

  update: kanbanProcedure.input(updateInput).mutation(async ({ input, ctx }) => {
    const { id, ...rest } = input;
    const updated = await ctx.kanbanModel.update(id, rest);
    if (!updated) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Kanban card not found' });
    }
    return updated;
  }),
});

export type KanbanRouter = typeof kanbanRouter;
