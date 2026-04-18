import { router } from '@/libs/trpc/lambda';

import { chartReviewRouter } from './chart-review';
import { kanbanRouter } from './kanban';
import { snapshotsRouter } from './snapshots';

export const pantheonRouter = router({
  chartReview: chartReviewRouter,
  kanban: kanbanRouter,
  snapshots: snapshotsRouter,
import { npRouter } from './np';
import { topologyRouter } from './topology';

export const pantheonRouter = router({
  kanban: kanbanRouter,
  np: npRouter,
  topology: topologyRouter,
});

export type PantheonRouter = typeof pantheonRouter;
