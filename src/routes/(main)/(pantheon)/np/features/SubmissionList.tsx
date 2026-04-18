'use client';

import { ActionIcon, Block, Flexbox, Tag, Text } from '@lobehub/ui';
import { App, Dropdown, Select, Table } from 'antd';
import { createStyles } from 'antd-style';
import { EllipsisIcon } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

const useStyles = createStyles(({ css, token }) => ({
  empty: css`
    padding: 48px;
    color: ${token.colorTextTertiary};
    text-align: center;
  `,
  tableWrap: css`
    padding: 16px;
  `,
  title: css`
    font-weight: 600;
  `,
}));

export type NPSubmissionStatus = 'draft' | 'submitted' | 'completed';

export interface NPSubmission {
  createdAt?: Date | string | null;
  externalTrackingId?: string | null;
  id: string;
  patientInitials?: string | null;
  status: NPSubmissionStatus;
  submissionText?: string | null;
  submittedBy?: string | null;
  title: string;
  updatedAt?: Date | string | null;
}

interface SubmissionListProps {
  onDelete: (row: NPSubmission) => void | Promise<void>;
  onEdit: (row: NPSubmission) => void;
  onStatusChange: (row: NPSubmission, status: NPSubmissionStatus) => void | Promise<void>;
  rows: NPSubmission[];
}

const STATUS_COLOR: Record<NPSubmissionStatus, string> = {
  completed: 'green',
  draft: 'default',
  submitted: 'blue',
};

const formatDate = (value: Date | string | null | undefined) => {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString();
};

const SubmissionList = memo<SubmissionListProps>(({ onDelete, onEdit, onStatusChange, rows }) => {
  const { t } = useTranslation('pantheon');
  const { styles } = useStyles();
  const { modal } = App.useApp();

  const confirmDelete = (row: NPSubmission) => {
    modal.confirm({
      content: row.title,
      okButtonProps: { danger: true },
      okText: t('np.submissions.rowActions.delete'),
      onOk: () => onDelete(row),
      title: t('np.submissions.rowActions.delete'),
    });
  };

  if (rows.length === 0) {
    return (
      <Block className={styles.empty} variant={'filled'}>
        {t('np.submissions.empty')}
      </Block>
    );
  }

  return (
    <Flexbox className={styles.tableWrap}>
      <Table<NPSubmission>
        dataSource={rows}
        pagination={false}
        rowKey={(r) => r.id}
        size={'middle'}
        columns={[
          {
            dataIndex: 'title',
            key: 'title',
            render: (val: string) => <span className={styles.title}>{val}</span>,
            title: t('np.submissions.columns.title'),
          },
          {
            dataIndex: 'patientInitials',
            key: 'patientInitials',
            render: (val: string | null | undefined) => val || <Text type={'secondary'}>—</Text>,
            title: t('np.submissions.columns.patientInitials'),
            width: 140,
          },
          {
            dataIndex: 'submittedBy',
            key: 'submittedBy',
            render: (val: string | null | undefined) => val || <Text type={'secondary'}>—</Text>,
            title: t('np.submissions.columns.submittedBy'),
            width: 160,
          },
          {
            dataIndex: 'status',
            key: 'status',
            render: (status: NPSubmissionStatus, row) => (
              <Select<NPSubmissionStatus>
                size={'small'}
                style={{ minWidth: 120 }}
                value={status}
                options={[
                  {
                    label: <Tag color={STATUS_COLOR.draft}>{t('np.submissions.status.draft')}</Tag>,
                    value: 'draft',
                  },
                  {
                    label: (
                      <Tag color={STATUS_COLOR.submitted}>
                        {t('np.submissions.status.submitted')}
                      </Tag>
                    ),
                    value: 'submitted',
                  },
                  {
                    label: (
                      <Tag color={STATUS_COLOR.completed}>
                        {t('np.submissions.status.completed')}
                      </Tag>
                    ),
                    value: 'completed',
                  },
                ]}
                onChange={(next) => onStatusChange(row, next)}
              />
            ),
            title: t('np.submissions.columns.status'),
            width: 160,
          },
          {
            dataIndex: 'externalTrackingId',
            key: 'externalTrackingId',
            render: (val: string | null | undefined) =>
              val ? <code>{val}</code> : <Text type={'secondary'}>—</Text>,
            title: t('np.submissions.columns.trackingId'),
            width: 160,
          },
          {
            dataIndex: 'updatedAt',
            key: 'updatedAt',
            render: (val: Date | string | null | undefined) => (
              <Text type={'secondary'}>{formatDate(val)}</Text>
            ),
            title: t('np.submissions.columns.updatedAt'),
            width: 180,
          },
          {
            key: 'actions',
            render: (_: unknown, row) => (
              <Dropdown
                trigger={['click']}
                menu={{
                  items: [
                    {
                      key: 'edit',
                      label: t('np.submissions.rowActions.edit'),
                      onClick: () => onEdit(row),
                    },
                    {
                      danger: true,
                      key: 'delete',
                      label: t('np.submissions.rowActions.delete'),
                      onClick: () => confirmDelete(row),
                    },
                  ],
                }}
              >
                <ActionIcon icon={EllipsisIcon} size={'small'} />
              </Dropdown>
            ),
            title: '',
            width: 48,
          },
        ]}
      />
    </Flexbox>
  );
});

SubmissionList.displayName = 'SubmissionList';

export default SubmissionList;
