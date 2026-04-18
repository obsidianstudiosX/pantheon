import { router } from '@/libs/trpc/lambda';

import { chartReviewRouter } from './chart-review';
import { kanbanRouter } from './kanban';

export const pantheonRouter = router({
  chartReview: chartReviewRouter,
  kanban: kanbanRouter,
});

export type PantheonRouter = typeof pantheonRouter;
