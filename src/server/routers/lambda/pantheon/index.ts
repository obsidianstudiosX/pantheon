import { router } from '@/libs/trpc/lambda';

import { kanbanRouter } from './kanban';

export const pantheonRouter = router({
  kanban: kanbanRouter,
});

export type PantheonRouter = typeof pantheonRouter;
