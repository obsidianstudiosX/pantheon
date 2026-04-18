'use client';

import { ActionIcon, Block, Flexbox, Tag, Text } from '@lobehub/ui';
import { App, Dropdown } from 'antd';
import { createStyles } from 'antd-style';
import { EllipsisIcon } from 'lucide-react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';

const useStyles = createStyles(({ css, token }) => ({
  empty: css`
    padding: 24px 8px;
    font-size: 12px;
    color: ${token.colorTextTertiary};
    text-align: center;
  `,
  list: css`
    display: flex;
    flex-direction: column;
    gap: 8px;

    width: 100%;
    padding: 16px;
  `,
  row: css`
    cursor: default;

    display: flex;
    flex-direction: column;
    gap: 4px;

    padding: 12px 16px;
    border-radius: 8px;

    background: ${token.colorBgElevated};
  `,
  rowHeader: css`
    font-size: 14px;
    font-weight: 600;
  `,
  timestamp: css`
    font-size: 12px;
    color: ${token.colorTextDescription};
  `,
}));

export interface SnapshotRow {
  agentId: string;
  createdAt: string;
  id: string;
  label: string;
  parentSnapshotId?: string | null;
}

interface SnapshotListProps {
  onDelete: (row: SnapshotRow) => void | Promise<void>;
  onDiff: (a: SnapshotRow, b: SnapshotRow) => void;
  onRestore: (row: SnapshotRow) => void | Promise<void>;
  rows: SnapshotRow[];
}

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

const SnapshotList = memo<SnapshotListProps>(({ rows, onRestore, onDelete, onDiff }) => {
  const { t } = useTranslation('pantheon');
  const { styles } = useStyles();
  const { modal } = App.useApp();

  const [pendingDiff, setPendingDiff] = useState<SnapshotRow | null>(null);

  const confirmRestore = (row: SnapshotRow) => {
    modal.confirm({
      content: t('snapshots.restoreConfirm', { label: row.label }),
      okButtonProps: { danger: true },
      okText: t('snapshots.restore'),
      onOk: () => onRestore(row),
      title: t('snapshots.restore'),
    });
  };

  const confirmDelete = (row: SnapshotRow) => {
    modal.confirm({
      content: row.label,
      okButtonProps: { danger: true },
      okText: t('snapshots.delete'),
      onOk: () => onDelete(row),
      title: t('snapshots.delete'),
    });
  };

  const startOrCompleteDiff = (row: SnapshotRow) => {
    if (!pendingDiff) {
      setPendingDiff(row);
      return;
    }
    if (pendingDiff.id === row.id) {
      setPendingDiff(null);
      return;
    }
    onDiff(pendingDiff, row);
    setPendingDiff(null);
  };

  if (rows.length === 0) {
    return <div className={styles.empty}>{t('snapshots.empty')}</div>;
  }

  return (
    <Flexbox className={styles.list}>
      {rows.map((row) => {
        const isDiffPending = pendingDiff?.id === row.id;
        return (
          <Block className={styles.row} key={row.id} variant={'outlined'}>
            <Flexbox horizontal align={'center'} gap={12} justify={'space-between'}>
              <Flexbox flex={1} gap={4}>
                <Flexbox horizontal align={'center'} gap={8}>
                  <span className={styles.rowHeader}>{row.label}</span>
                  {isDiffPending && <Tag color={'blue'}>{t('snapshots.diffPending')}</Tag>}
                  {row.parentSnapshotId && (
                    <Tag color={'default'}>
                      {t('snapshots.parent', { id: row.parentSnapshotId.slice(0, 8) })}
                    </Tag>
                  )}
                </Flexbox>
                <Text className={styles.timestamp}>{formatDate(row.createdAt)}</Text>
              </Flexbox>
              <Dropdown
                menu={{
                  items: [
                    {
                      key: 'restore',
                      label: t('snapshots.restore'),
                      onClick: () => confirmRestore(row),
                    },
                    {
                      key: 'diff',
                      label: isDiffPending
                        ? t('snapshots.diffCancel')
                        : pendingDiff
                          ? t('snapshots.diffWith', { label: pendingDiff.label })
                          : t('snapshots.diffStart'),
                      onClick: () => startOrCompleteDiff(row),
                    },
                    { type: 'divider' },
                    {
                      danger: true,
                      key: 'delete',
                      label: t('snapshots.delete'),
                      onClick: () => confirmDelete(row),
                    },
                  ],
                }}
                trigger={['click']}
              >
                <ActionIcon icon={EllipsisIcon} size={'small'} />
              </Dropdown>
            </Flexbox>
          </Block>
        );
      })}
    </Flexbox>
  );
});

SnapshotList.displayName = 'SnapshotList';

export default SnapshotList;
