import { router } from '@/libs/trpc/lambda';

import { chartReviewRouter } from './chart-review';
import { kanbanRouter } from './kanban';
import { npRouter } from './np';
import { snapshotsRouter } from './snapshots';
import { topologyRouter } from './topology';

export const pantheonRouter = router({
  chartReview: chartReviewRouter,
  kanban: kanbanRouter,
  np: npRouter,
  snapshots: snapshotsRouter,
  topology: topologyRouter,
});

export type PantheonRouter = typeof pantheonRouter;
