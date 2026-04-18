'use client';

import { Block, Flexbox, Tag, Text } from '@lobehub/ui';
import { Tabs } from 'antd';
import { createStyles } from 'antd-style';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

export type ChartReviewStatus =
  | 'pending'
  | 'approved'
  | 'dispatched'
  | 'rejected';

export interface ChartReviewRow {
  agentId: string | null;
  createdAt: Date | string;
  dispatchedAt: Date | string | null;
  id: string;
  phiTypes: string[];
  redactedText?: string | null;
  rejectReason: string | null;
  status: ChartReviewStatus;
  submittedText: string;
}

interface ReviewQueueProps {
  activeId?: string;
  onSelect: (row: ChartReviewRow) => void;
  rows: ChartReviewRow[];
}

const STATUS_ORDER: ChartReviewStatus[] = [
  'pending',
  'approved',
  'dispatched',
  'rejected',
];

const useStyles = createStyles(({ css, token }) => ({
  container: css`
    overflow: auto;
    flex: 1;
    min-height: 0;
    padding: 12px;
  `,
  empty: css`
    padding: 24px;
    font-size: 12px;
    color: ${token.colorTextTertiary};
    text-align: center;
  `,
  item: css`
    cursor: pointer;

    display: flex;
    flex-direction: column;
    gap: 6px;

    padding: 10px 12px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 6px;

    background: ${token.colorBgElevated};

    transition: border-color 120ms;

    &:hover {
      border-color: ${token.colorPrimary};
    }
  `,
  itemActive: css`
    border-color: ${token.colorPrimary} !important;
    box-shadow: 0 0 0 2px ${token.colorPrimaryBorder};
  `,
  itemPreview: css`
    overflow: hidden;
    display: -webkit-box;

    font-family: ${token.fontFamilyCode};
    font-size: 12px;
    line-height: 1.4;
    color: ${token.colorTextSecondary};
    text-overflow: ellipsis;

    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  `,
  list: css`
    display: flex;
    flex-direction: column;
    gap: 8px;
  `,
  meta: css`
    font-size: 11px;
    color: ${token.colorTextTertiary};
  `,
  tabs: css`
    flex: 1;
    min-height: 0;

    .ant-tabs-nav {
      padding-inline: 12px;
      margin: 0;
    }

    .ant-tabs-content-holder {
      overflow: auto;
      flex: 1;
      min-height: 0;
    }

    .ant-tabs-content,
    .ant-tabs-tabpane {
      height: 100%;
    }
  `,
}));

const STATUS_COLOR: Record<ChartReviewStatus, string> = {
  approved: 'blue',
  dispatched: 'green',
  pending: 'orange',
  rejected: 'red',
};

const formatDate = (v: Date | string | null | undefined): string => {
  if (!v) return '';
  const d = typeof v === 'string' ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString();
};

const ReviewQueue = memo<ReviewQueueProps>(({ activeId, onSelect, rows }) => {
  const { t } = useTranslation('pantheon');
  const { styles, cx } = useStyles();

  const grouped = useMemo(() => {
    const out: Record<ChartReviewStatus, ChartReviewRow[]> = {
      approved: [],
      dispatched: [],
      pending: [],
      rejected: [],
    };
    for (const r of rows) {
      if (out[r.status]) out[r.status].push(r);
    }
    return out;
  }, [rows]);

  return (
    <Block
      style={{ display: 'flex', flex: 1, flexDirection: 'column', minHeight: 0 }}
      variant={'outlined'}
    >
      <Tabs
        className={styles.tabs}
        destroyOnHidden={false}
        items={STATUS_ORDER.map((status) => ({
          children: (
            <Flexbox className={styles.container}>
              {grouped[status].length === 0 ? (
                <div className={styles.empty}>{t('chartReview.queue.empty')}</div>
              ) : (
                <div className={styles.list}>
                  {grouped[status].map((row) => (
                    <div
                      className={cx(
                        styles.item,
                        row.id === activeId && styles.itemActive,
                      )}
                      key={row.id}
                      onClick={() => onSelect(row)}
                      role={'button'}
                      tabIndex={0}
                    >
                      <Flexbox
                        align={'center'}
                        gap={6}
                        horizontal
                        justify={'space-between'}
                      >
                        <Tag color={STATUS_COLOR[row.status]}>
                          {t(`chartReview.status.${row.status}`)}
                        </Tag>
                        <span className={styles.meta}>
                          {formatDate(row.createdAt)}
                        </span>
                      </Flexbox>
                      <Text className={styles.itemPreview}>
                        {row.submittedText}
                      </Text>
                      {row.phiTypes.length > 0 && (
                        <Flexbox gap={4} horizontal wrap={'wrap'}>
                          {row.phiTypes.map((p) => (
                            <Tag color={'red'} key={p}>
                              {p}
                            </Tag>
                          ))}
                        </Flexbox>
                      )}
                      {row.agentId && (
                        <span className={styles.meta}>
                          {t('chartReview.queue.agent')}: {row.agentId}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Flexbox>
          ),
          key: status,
          label: (
            <span>
              {t(`chartReview.status.${status}`)} ({grouped[status].length})
            </span>
          ),
        }))}
      />
    </Block>
  );
});

ReviewQueue.displayName = 'ReviewQueue';

export default ReviewQueue;
