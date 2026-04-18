import { router } from '@/libs/trpc/lambda';

import { kanbanRouter } from './kanban';
import { snapshotsRouter } from './snapshots';

export const pantheonRouter = router({
  kanban: kanbanRouter,
  snapshots: snapshotsRouter,
});

export type PantheonRouter = typeof pantheonRouter;
