'use client';

import { ActionIcon, Block, Flexbox, Tag, Text } from '@lobehub/ui';
import { App, Dropdown } from 'antd';
import { createStyles } from 'antd-style';
import { EllipsisIcon } from 'lucide-react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

const useStyles = createStyles(({ css, token }) => ({
  board: css`
    display: grid;
    grid-gap: 16px;
    grid-template-columns: repeat(3, minmax(260px, 1fr));

    width: 100%;
    min-height: 0;
    padding: 16px;

    @media (max-width: 900px) {
      grid-template-columns: 1fr;
    }
  `,
  card: css`
    cursor: default;

    display: flex;
    flex-direction: column;
    gap: 8px;

    padding: 12px;
    border-radius: 8px;

    background: ${token.colorBgElevated};
  `,
  cardTitle: css`
    font-size: 14px;
    font-weight: 600;
  `,
  column: css`
    display: flex;
    flex-direction: column;
    min-height: 200px;
    padding: 12px;
    border-radius: 8px;

    background: ${token.colorFillQuaternary};
  `,
  columnBody: css`
    overflow-y: auto;
    flex: 1;
    gap: 8px;
  `,
  columnHeader: css`
    font-size: 14px;
    font-weight: 600;
    color: ${token.colorTextSecondary};
  `,
  description: css`
    font-size: 12px;
    color: ${token.colorTextDescription};
  `,
  empty: css`
    padding: 24px 8px;
    font-size: 12px;
    color: ${token.colorTextTertiary};
    text-align: center;
  `,
}));

export type KanbanStatus = 'backlog' | 'in-progress' | 'done';

export interface KanbanCard {
  agentId?: string | null;
  description?: string | null;
  id: string;
  priority?: number | null;
  status: KanbanStatus;
  title: string;
}

interface KanbanBoardProps {
  cards: KanbanCard[];
  onDelete: (card: KanbanCard) => void | Promise<void>;
  onEdit: (card: KanbanCard) => void;
  onStatusChange: (card: KanbanCard, status: KanbanStatus) => void | Promise<void>;
}

const PRIORITY_LABEL: Record<number, string> = {
  0: 'kanban.form.priority.0',
  1: 'kanban.form.priority.1',
  2: 'kanban.form.priority.2',
  3: 'kanban.form.priority.3',
};

const COLUMN_ORDER: KanbanStatus[] = ['backlog', 'in-progress', 'done'];

const COLUMN_LABEL: Record<KanbanStatus, string> = {
  'backlog': 'kanban.columns.backlog',
  'done': 'kanban.columns.done',
  'in-progress': 'kanban.columns.inProgress',
};

const KanbanBoard = memo<KanbanBoardProps>(({ cards, onDelete, onEdit, onStatusChange }) => {
  const { t } = useTranslation('pantheon');
  const { styles } = useStyles();
  const { modal } = App.useApp();

  const grouped = useMemo(() => {
    const out: Record<KanbanStatus, KanbanCard[]> = {
      'backlog': [],
      'done': [],
      'in-progress': [],
    };
    for (const c of cards) {
      if (out[c.status]) out[c.status].push(c);
    }
    return out;
  }, [cards]);

  const handleDelete = (card: KanbanCard) => {
    modal.confirm({
      content: card.title,
      okButtonProps: { danger: true },
      okText: t('kanban.rowActions.delete'),
      onOk: () => onDelete(card),
      title: t('kanban.rowActions.delete'),
    });
  };

  return (
    <Flexbox className={styles.board}>
      {COLUMN_ORDER.map((status) => (
        <Flexbox className={styles.column} key={status}>
          <Flexbox horizontal align={'center'} gap={8} justify={'space-between'} padding={'0 4px'}>
            <span className={styles.columnHeader}>{t(COLUMN_LABEL[status])}</span>
            <Tag>{grouped[status].length}</Tag>
          </Flexbox>
          <Flexbox className={styles.columnBody} paddingBlock={8}>
            {grouped[status].length === 0 && (
              <div className={styles.empty}>{t('kanban.empty')}</div>
            )}
            {grouped[status].map((card) => {
              const moveItems = COLUMN_ORDER.filter((s) => s !== card.status).map((s) => ({
                key: s,
                label: t(COLUMN_LABEL[s]),
                onClick: () => onStatusChange(card, s),
              }));
              return (
                <Block className={styles.card} key={card.id} variant={'outlined'}>
                  <Flexbox horizontal align={'flex-start'} gap={8} justify={'space-between'}>
                    <span className={styles.cardTitle}>{card.title}</span>
                    <Dropdown
                      menu={{
                        items: [
                          {
                            children: moveItems,
                            key: 'move',
                            label: t('kanban.moveTo'),
                          },
                          { type: 'divider' },
                          {
                            key: 'edit',
                            label: t('kanban.rowActions.edit'),
                            onClick: () => onEdit(card),
                          },
                          {
                            danger: true,
                            key: 'delete',
                            label: t('kanban.rowActions.delete'),
                            onClick: () => handleDelete(card),
                          },
                        ],
                      }}
                      trigger={['click']}
                    >
                      <ActionIcon icon={EllipsisIcon} size={'small'} />
                    </Dropdown>
                  </Flexbox>
                  {card.description && (
                    <Text className={styles.description} ellipsis={{ rows: 3 }}>
                      {card.description}
                    </Text>
                  )}
                  {typeof card.priority === 'number' && card.priority > 0 && (
                    <div>
                      <Tag color={card.priority >= 3 ? 'red' : card.priority >= 2 ? 'orange' : 'blue'}>
                        {t(PRIORITY_LABEL[card.priority] || PRIORITY_LABEL[0])}
                      </Tag>
                    </div>
                  )}
                </Block>
              );
            })}
          </Flexbox>
        </Flexbox>
      ))}
    </Flexbox>
  );
});

KanbanBoard.displayName = 'KanbanBoard';

export default KanbanBoard;
