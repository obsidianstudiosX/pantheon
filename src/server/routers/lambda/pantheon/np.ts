import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { NPResourceModel, NPSubmissionModel } from '@/database/models/pantheon/np';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';

// -- shared procedure with both models attached ------------------------------

const npProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;
  return opts.next({
    ctx: {
      npResourceModel: new NPResourceModel(ctx.serverDB, ctx.userId),
      npSubmissionModel: new NPSubmissionModel(ctx.serverDB, ctx.userId),
    },
  });
});

// -- submissions sub-router --------------------------------------------------

const submissionStatus = z.enum(['draft', 'submitted', 'completed']);

const submissionCreate = z.object({
  externalTrackingId: z.string().max(255).optional().nullable(),
  // Initials only — 1..8 chars, dots/uppercase letters. Enforced here and in UI.
  patientInitials: z
    .string()
    .max(8)
    .regex(/^[A-Z.\- ]*$/i, 'Initials may contain letters, dots, hyphens, spaces only')
    .optional()
    .nullable(),
  status: submissionStatus.optional(),
  submissionText: z.string().optional().nullable(),
  submittedBy: z.string().max(255).optional().nullable(),
  title: z.string().min(1).max(255),
});

const submissionUpdate = z.object({
  id: z.string(),
  externalTrackingId: z.string().max(255).optional().nullable(),
  patientInitials: z
    .string()
    .max(8)
    .regex(/^[A-Z.\- ]*$/i, 'Initials may contain letters, dots, hyphens, spaces only')
    .optional()
    .nullable(),
  status: submissionStatus.optional(),
  submissionText: z.string().optional().nullable(),
  submittedBy: z.string().max(255).optional().nullable(),
  title: z.string().min(1).max(255).optional(),
});

export const submissionsRouter = router({
  create: npProcedure.input(submissionCreate).mutation(async ({ input, ctx }) => {
    try {
      return await ctx.npSubmissionModel.create(input);
    } catch (error) {
      console.error('[pantheon.np.submissions.create]', error);
      throw new TRPCError({
        cause: error,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create NP submission',
      });
    }
  }),

  delete: npProcedure.input(z.object({ id: z.string() })).mutation(async ({ input, ctx }) => {
    const ok = await ctx.npSubmissionModel.delete(input.id);
    if (!ok) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'NP submission not found' });
    }
    return { success: true };
  }),

  list: npProcedure.query(async ({ ctx }) => {
    return ctx.npSubmissionModel.list();
  }),

  update: npProcedure.input(submissionUpdate).mutation(async ({ input, ctx }) => {
    const { id, ...rest } = input;
    const updated = await ctx.npSubmissionModel.update(id, rest);
    if (!updated) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'NP submission not found' });
    }
    return updated;
  }),
});

// -- resources sub-router ----------------------------------------------------

const resourceCreate = z.object({
  createdBy: z.string().max(255).optional().nullable(),
  description: z.string().optional().nullable(),
  sortOrder: z.number().int().optional(),
  tags: z.array(z.string()).optional(),
  title: z.string().min(1).max(255),
  url: z.string().url(),
});

const resourceUpdate = z.object({
  id: z.string(),
  createdBy: z.string().max(255).optional().nullable(),
  description: z.string().optional().nullable(),
  sortOrder: z.number().int().optional(),
  tags: z.array(z.string()).optional(),
  title: z.string().min(1).max(255).optional(),
  url: z.string().url().optional(),
});

export const resourcesRouter = router({
  create: npProcedure.input(resourceCreate).mutation(async ({ input, ctx }) => {
    try {
      return await ctx.npResourceModel.create(input);
    } catch (error) {
      console.error('[pantheon.np.resources.create]', error);
      throw new TRPCError({
        cause: error,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create NP resource',
      });
    }
  }),

  delete: npProcedure.input(z.object({ id: z.string() })).mutation(async ({ input, ctx }) => {
    const ok = await ctx.npResourceModel.delete(input.id);
    if (!ok) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'NP resource not found' });
    }
    return { success: true };
  }),

  list: npProcedure.query(async ({ ctx }) => {
    return ctx.npResourceModel.list();
  }),

  update: npProcedure.input(resourceUpdate).mutation(async ({ input, ctx }) => {
    const { id, ...rest } = input;
    const updated = await ctx.npResourceModel.update(id, rest);
    if (!updated) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'NP resource not found' });
    }
    return updated;
  }),
});

// -- combined np router ------------------------------------------------------

export const npRouter = router({
  resources: resourcesRouter,
  submissions: submissionsRouter,
});

export type NpRouter = typeof npRouter;
