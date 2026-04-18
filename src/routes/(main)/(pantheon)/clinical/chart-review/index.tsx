'use client';

import { Block, Flexbox, Text } from '@lobehub/ui';
import { App } from 'antd';
import { createStyles } from 'antd-style';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

import Loading from '@/components/Loading/BrandTextLoading';
import NavHeader from '@/features/NavHeader';
import { lambdaClient } from '@/libs/trpc/client';
import { featureFlagsSelectors, useServerConfigStore } from '@/store/serverConfig';

import ReviewDrawer, {
  type ChartReviewResultRow,
} from './features/ReviewDrawer';
import ReviewQueue, {
  type ChartReviewRow,
  type ChartReviewStatus,
} from './features/ReviewQueue';
import SubmitForm from './features/SubmitForm';
import { PHI_PATTERNS_CLIENT } from './features/phi-highlight';

const QUEUE_SWR_KEY = 'pantheon-chart-review-queue';

const useStyles = createStyles(({ css, token }) => ({
  disabled: css`
    padding: 48px;
    color: ${token.colorTextSecondary};
    text-align: center;
  `,
  error: css`
    padding: 24px;
    color: ${token.colorErrorText};
    text-align: center;
  `,
  header: css`
    padding: 16px;

    h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
    }
  `,
  leftPane: css`
    overflow: auto;
    flex: 1;
    min-width: 0;
    padding: 16px;
  `,
  rightPane: css`
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    padding: 16px;
  `,
  split: css`
    display: grid;
    grid-gap: 0;
    grid-template-columns: minmax(360px, 1fr) minmax(320px, 1fr);

    flex: 1;
    min-height: 0;

    @media (max-width: 1000px) {
      grid-template-columns: 1fr;
    }
  `,
}));

/**
 * Local detectPhi mirror — avoids a server roundtrip on every keystroke.
 * Must stay in sync with `PHI_PATTERNS_CLIENT` which itself mirrors the
 * server patterns. The server remains the source of truth on submit.
 */
const detectPhiLocal = (text: string): string[] => {
  const found: string[] = [];
  for (const [name, pat] of PHI_PATTERNS_CLIENT) {
    const re = new RegExp(pat.source, pat.flags.replace('g', ''));
    if (re.test(text)) found.push(name);
  }
  return found;
};

type QueueRow = Awaited<
  ReturnType<typeof lambdaClient.pantheon.chartReview.listQueue.query>
>[number];

const toRow = (r: QueueRow): ChartReviewRow => ({
  agentId: r.agentId,
  createdAt: r.createdAt,
  dispatchedAt: r.dispatchedAt,
  id: r.id,
  phiTypes: Array.isArray(r.phiTypes) ? (r.phiTypes as string[]) : [],
  redactedText: r.redactedText,
  rejectReason: r.rejectReason,
  status: (r.status as ChartReviewStatus) ?? 'pending',
  submittedText: r.submittedText,
});

const PantheonChartReviewPage = memo(() => {
  const { t } = useTranslation('pantheon');
  const { styles } = useStyles();
  const { message } = App.useApp();
  const enabled = useServerConfigStore(
    (s) => featureFlagsSelectors(s).pantheonClinicalChartReviewEnabled,
  );

  // Controlled submit form — keep text in page scope so detectPhi ticks while
  // the operator types, and so resetting on submit is trivial.
  const [submitText, setSubmitText] = useState<string>('');
  const [submitLoading, setSubmitLoading] = useState<boolean>(false);
  const detectedPhi = useMemo(() => detectPhiLocal(submitText), [submitText]);

  // Drawer state.
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [activeId, setActiveId] = useState<string | undefined>(undefined);
  const [drawerLoading, setDrawerLoading] = useState<boolean>(false);

  const {
    data: queue,
    error: queueError,
    isLoading: queueLoading,
    mutate: mutateQueue,
  } = useSWR<ChartReviewRow[]>(
    enabled === false ? null : [QUEUE_SWR_KEY],
    async () => {
      const rows = await lambdaClient.pantheon.chartReview.listQueue.query();
      return rows.map(toRow);
    },
    { revalidateOnFocus: true },
  );

  const activeRow = useMemo(
    () => (activeId ? (queue ?? []).find((r) => r.id === activeId) ?? null : null),
    [activeId, queue],
  );

  // Single-active-item result fetch. Refetches on status changes.
  const { data: activeDetail, mutate: mutateDetail } = useSWR(
    activeRow ? ['pantheon-chart-review-detail', activeRow.id] : null,
    async () => {
      if (!activeRow) return null;
      const detail = await lambdaClient.pantheon.chartReview.get.query({
        id: activeRow.id,
      });
      const results: ChartReviewResultRow[] = detail.results.map((r) => ({
        createdAt: r.createdAt,
        id: r.id,
        latencyMs: r.latencyMs,
        response: r.response,
        tokensIn: r.tokensIn,
        tokensOut: r.tokensOut,
      }));
      return { item: detail.item, results };
    },
  );

  useEffect(() => {
    if (!drawerOpen) return;
    void mutateDetail();
  }, [drawerOpen, activeId, mutateDetail]);

  const handleSubmit = useCallback(
    async ({ userText }: { agentId: string; userText: string }) => {
      setSubmitLoading(true);
      try {
        await lambdaClient.pantheon.chartReview.submit.mutate({ userText });
        setSubmitText('');
        await mutateQueue();
        message.success(t('chartReview.submit.success'));
      } catch (err) {
        console.error('[chartReview.submit]', err);
        message.error(t('chartReview.submit.error'));
      } finally {
        setSubmitLoading(false);
      }
    },
    [message, mutateQueue, t],
  );

  const handleSelect = useCallback((row: ChartReviewRow) => {
    setActiveId(row.id);
    setDrawerOpen(true);
  }, []);

  const handleApprove = useCallback(
    async (id: string, redactedText: string) => {
      setDrawerLoading(true);
      try {
        await lambdaClient.pantheon.chartReview.approve.mutate({
          id,
          redactedText,
        });
        await Promise.all([mutateQueue(), mutateDetail()]);
        message.success(t('chartReview.drawer.approveSuccess'));
      } finally {
        setDrawerLoading(false);
      }
    },
    [message, mutateDetail, mutateQueue, t],
  );

  const handleReject = useCallback(
    async (id: string, reason: string | undefined) => {
      setDrawerLoading(true);
      try {
        await lambdaClient.pantheon.chartReview.reject.mutate({ id, reason });
        await Promise.all([mutateQueue(), mutateDetail()]);
        message.success(t('chartReview.drawer.rejectSuccess'));
      } finally {
        setDrawerLoading(false);
      }
    },
    [message, mutateDetail, mutateQueue, t],
  );

  const handleDispatch = useCallback(
    async (id: string, agentId: string) => {
      setDrawerLoading(true);
      try {
        await lambdaClient.pantheon.chartReview.dispatch.mutate({ agentId, id });
        await Promise.all([mutateQueue(), mutateDetail()]);
        message.success(t('chartReview.drawer.dispatchSuccess'));
      } finally {
        setDrawerLoading(false);
      }
    },
    [message, mutateDetail, mutateQueue, t],
  );

  if (enabled === false) {
    return (
      <Flexbox flex={1} height={'100%'}>
        <NavHeader />
        <Block className={styles.disabled} variant={'filled'}>
          {t('chartReview.featureDisabled')}
        </Block>
      </Flexbox>
    );
  }

  return (
    <Flexbox flex={1} height={'100%'}>
      <NavHeader />
      <Flexbox className={styles.header} gap={4}>
        <h2>{t('chartReview.pageTitle')}</h2>
        <Text type={'secondary'}>{t('chartReview.pageDescription')}</Text>
      </Flexbox>

      <div className={styles.split}>
        <div className={styles.leftPane}>
          <SubmitForm
            detectedPhi={detectedPhi}
            loading={submitLoading}
            onSubmit={handleSubmit}
            onTextChange={setSubmitText}
            text={submitText}
          />
        </div>
        <div className={styles.rightPane}>
          {queueLoading && <Loading debugId="PantheonChartReviewQueue" />}
          {queueError && (
            <div className={styles.error}>{t('chartReview.queue.error')}</div>
          )}
          {!queueLoading && !queueError && (
            <ReviewQueue
              activeId={activeId}
              onSelect={handleSelect}
              rows={queue ?? []}
            />
          )}
        </div>
      </div>

      <ReviewDrawer
        // Prefer the detail-fetched item (has the freshest redactedText after
        // approve) but fall back to the list row while the detail query is
        // still in flight.
        item={
          activeDetail?.item
            ? toRow(activeDetail.item as QueueRow)
            : activeRow ?? null
        }
        loading={drawerLoading}
        onApprove={handleApprove}
        onClose={() => setDrawerOpen(false)}
        onDispatch={handleDispatch}
        onReject={handleReject}
        open={drawerOpen}
        results={activeDetail?.results ?? []}
      />
    </Flexbox>
  );
});

PantheonChartReviewPage.displayName = 'PantheonChartReviewPage';

export default PantheonChartReviewPage;
