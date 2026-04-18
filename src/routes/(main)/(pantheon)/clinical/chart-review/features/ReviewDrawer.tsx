'use client';

import { Block, Button, Flexbox, Tag, Text } from '@lobehub/ui';
import { App, Drawer, Input, Select } from 'antd';
import { createStyles } from 'antd-style';
import { CheckIcon, SendIcon, XIcon } from 'lucide-react';
import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PANTHEON_AGENTS } from '@/config/pantheon/registry';

import type { ChartReviewRow } from './ReviewQueue';
import { highlightPhi } from './phi-highlight';

export interface ChartReviewResultRow {
  createdAt: Date | string;
  id: string;
  latencyMs: number | null;
  response: string;
  tokensIn: number | null;
  tokensOut: number | null;
}

interface ReviewDrawerProps {
  item: ChartReviewRow | null;
  loading?: boolean;
  onApprove: (id: string, redactedText: string) => Promise<void>;
  onClose: () => void;
  onDispatch: (id: string, agentId: string) => Promise<void>;
  onReject: (id: string, reason: string | undefined) => Promise<void>;
  open: boolean;
  results: ChartReviewResultRow[];
}

const useStyles = createStyles(({ css, token }) => ({
  codeBlock: css`
    overflow: auto;

    max-height: 240px;
    padding: 10px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 6px;

    font-family: ${token.fontFamilyCode};
    font-size: 12px;
    line-height: 1.55;
    white-space: pre-wrap;

    background: ${token.colorFillQuaternary};

    mark {
      padding: 0 2px;
      border-radius: 2px;

      color: ${token.colorErrorText};

      background: ${token.colorErrorBg};
    }
  `,
  header: css`
    font-size: 14px;
    font-weight: 600;
    color: ${token.colorTextSecondary};
  `,
  label: css`
    font-size: 12px;
    font-weight: 600;
    color: ${token.colorTextSecondary};
  `,
  meta: css`
    font-size: 11px;
    color: ${token.colorTextTertiary};
  `,
  resultBlock: css`
    padding: 10px;

    background: ${token.colorBgElevated};
  `,
  section: css`
    display: flex;
    flex-direction: column;
    gap: 6px;
  `,
}));

const formatDate = (v: Date | string | null | undefined): string => {
  if (!v) return '';
  const d = typeof v === 'string' ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString();
};

const DEFAULT_AGENT_ID = 'teresse-clinical';

const ReviewDrawer = memo<ReviewDrawerProps>(
  ({ item, loading, onApprove, onClose, onDispatch, onReject, open, results }) => {
    const { t } = useTranslation('pantheon');
    const { styles } = useStyles();
    const { message, modal } = App.useApp();

    const [redactedDraft, setRedactedDraft] = useState<string>('');
    const [rejectReason, setRejectReason] = useState<string>('');
    const [dispatchAgent, setDispatchAgent] = useState<string>(DEFAULT_AGENT_ID);

    useEffect(() => {
      if (!item) return;
      // Seed the scrubbed-text editor with whatever the server already
      // persisted (on re-open of an approved row) or the raw submitted
      // text (first open of a pending row).
      setRedactedDraft(item.redactedText ?? item.submittedText);
      setDispatchAgent(item.agentId || DEFAULT_AGENT_ID);
      setRejectReason('');
    }, [item]);

    const agentOptions = useMemo(
      () =>
        PANTHEON_AGENTS.map((a) => ({
          label: `${a.agent_id}${a.phi_aware ? '  [phi_aware]' : ''}`,
          value: a.agent_id,
        })),
      [],
    );

    const submittedHighlighted = useMemo(
      () => (item ? highlightPhi(item.submittedText) : ''),
      [item],
    );

    const handleApprove = async () => {
      if (!item) return;
      if (!redactedDraft.trim()) {
        message.warning(t('chartReview.drawer.emptyRedactedWarning'));
        return;
      }
      try {
        await onApprove(item.id, redactedDraft);
      } catch (err) {
        console.error('[chartReview.drawer.approve]', err);
        message.error(t('chartReview.drawer.error'));
      }
    };

    const handleReject = () => {
      if (!item) return;
      modal.confirm({
        content: t('chartReview.drawer.rejectConfirm'),
        okButtonProps: { danger: true },
        okText: t('chartReview.drawer.reject'),
        onOk: async () => {
          try {
            await onReject(item.id, rejectReason || undefined);
          } catch (err) {
            console.error('[chartReview.drawer.reject]', err);
            message.error(t('chartReview.drawer.error'));
          }
        },
        title: t('chartReview.drawer.rejectTitle'),
      });
    };

    const handleDispatch = async () => {
      if (!item) return;
      try {
        await onDispatch(item.id, dispatchAgent);
      } catch (err) {
        console.error('[chartReview.drawer.dispatch]', err);
        message.error(
          err instanceof Error ? err.message : t('chartReview.drawer.error'),
        );
      }
    };

    return (
      <Drawer
        footer={null}
        onClose={onClose}
        open={open}
        title={
          item ? (
            <Flexbox align={'center'} gap={8} horizontal>
              <span>{t('chartReview.drawer.title')}</span>
              <Tag>{item.id}</Tag>
              <Tag>{t(`chartReview.status.${item.status}`)}</Tag>
            </Flexbox>
          ) : (
            t('chartReview.drawer.title')
          )
        }
        width={640}
      >
        {item ? (
          <Flexbox gap={16}>
            <div className={styles.section}>
              <span className={styles.header}>
                {t('chartReview.drawer.submittedText')}
              </span>
              <span className={styles.meta}>
                {t('chartReview.queue.createdAt')}: {formatDate(item.createdAt)}
              </span>
              <div
                className={styles.codeBlock}
                dangerouslySetInnerHTML={{ __html: submittedHighlighted }}
              />
              {item.phiTypes.length > 0 && (
                <Flexbox gap={4} horizontal wrap={'wrap'}>
                  {item.phiTypes.map((p) => (
                    <Tag color={'red'} key={p}>
                      {p}
                    </Tag>
                  ))}
                </Flexbox>
              )}
            </div>

            {(item.status === 'pending' || item.status === 'approved') && (
              <div className={styles.section}>
                <span className={styles.header}>
                  {t('chartReview.drawer.redactedText')}
                </span>
                <Text className={styles.meta} type={'secondary'}>
                  {t('chartReview.drawer.redactedHint')}
                </Text>
                <Input.TextArea
                  autoSize={{ maxRows: 18, minRows: 6 }}
                  onChange={(e) => setRedactedDraft(e.target.value)}
                  value={redactedDraft}
                />
                <Flexbox gap={8} horizontal>
                  <Button
                    icon={CheckIcon}
                    loading={loading}
                    onClick={handleApprove}
                    type={'primary'}
                  >
                    {t('chartReview.drawer.approve')}
                  </Button>
                  <Button
                    danger
                    icon={XIcon}
                    loading={loading}
                    onClick={handleReject}
                  >
                    {t('chartReview.drawer.reject')}
                  </Button>
                </Flexbox>
                <Input
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder={t('chartReview.drawer.rejectReasonPlaceholder')}
                  value={rejectReason}
                />
              </div>
            )}

            {item.status === 'approved' && (
              <div className={styles.section}>
                <span className={styles.header}>
                  {t('chartReview.drawer.dispatch')}
                </span>
                <Text className={styles.meta} type={'secondary'}>
                  {t('chartReview.drawer.dispatchHint')}
                </Text>
                <Flexbox gap={8} horizontal>
                  <Select
                    onChange={setDispatchAgent}
                    options={agentOptions}
                    showSearch
                    style={{ flex: 1 }}
                    value={dispatchAgent}
                  />
                  <Button
                    icon={SendIcon}
                    loading={loading}
                    onClick={handleDispatch}
                    type={'primary'}
                  >
                    {t('chartReview.drawer.dispatchButton')}
                  </Button>
                </Flexbox>
              </div>
            )}

            {item.status === 'dispatched' && (
              <div className={styles.section}>
                <span className={styles.header}>
                  {t('chartReview.drawer.dispatchedMeta')}
                </span>
                <span className={styles.meta}>
                  {t('chartReview.queue.agent')}: {item.agentId ?? '—'}
                </span>
                <span className={styles.meta}>
                  {t('chartReview.drawer.dispatchedAt')}:{' '}
                  {formatDate(item.dispatchedAt)}
                </span>
              </div>
            )}

            {item.status === 'rejected' && item.rejectReason && (
              <div className={styles.section}>
                <span className={styles.header}>
                  {t('chartReview.drawer.rejectReason')}
                </span>
                <Block className={styles.resultBlock} variant={'outlined'}>
                  <Text>{item.rejectReason}</Text>
                </Block>
              </div>
            )}

            {results.length > 0 && (
              <div className={styles.section}>
                <span className={styles.header}>
                  {t('chartReview.drawer.results')}
                </span>
                {results.map((r) => (
                  <Block
                    className={styles.resultBlock}
                    key={r.id}
                    variant={'outlined'}
                  >
                    <Flexbox gap={8}>
                      <Flexbox gap={8} horizontal wrap={'wrap'}>
                        <Tag>{formatDate(r.createdAt)}</Tag>
                        {r.latencyMs !== null && (
                          <Tag>{r.latencyMs}ms</Tag>
                        )}
                        {r.tokensIn !== null && (
                          <Tag>in: {r.tokensIn}</Tag>
                        )}
                        {r.tokensOut !== null && (
                          <Tag>out: {r.tokensOut}</Tag>
                        )}
                      </Flexbox>
                      <div className={styles.codeBlock}>{r.response}</div>
                    </Flexbox>
                  </Block>
                ))}
              </div>
            )}
          </Flexbox>
        ) : null}
      </Drawer>
    );
  },
);

ReviewDrawer.displayName = 'ReviewDrawer';

export default ReviewDrawer;
