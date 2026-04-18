import { router } from '@/libs/trpc/lambda';

import { kanbanRouter } from './kanban';
import { npRouter } from './np';
import { topologyRouter } from './topology';

export const pantheonRouter = router({
  kanban: kanbanRouter,
  np: npRouter,
  topology: topologyRouter,
});

export type PantheonRouter = typeof pantheonRouter;
