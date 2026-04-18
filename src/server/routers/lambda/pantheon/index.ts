import { router } from '@/libs/trpc/lambda';

import { kanbanRouter } from './kanban';
import { topologyRouter } from './topology';

export const pantheonRouter = router({
  kanban: kanbanRouter,
  topology: topologyRouter,
});

export type PantheonRouter = typeof pantheonRouter;
