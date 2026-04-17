'use client';

import { Block, Button, Flexbox, Text } from '@lobehub/ui';
import { App } from 'antd';
import { createStyles } from 'antd-style';
import { PlusIcon } from 'lucide-react';
import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

import Loading from '@/components/Loading/BrandTextLoading';
import NavHeader from '@/features/NavHeader';
import { lambdaClient } from '@/libs/trpc/client';
import { featureFlagsSelectors, useServerConfigStore } from '@/store/serverConfig';

import CreateCardModal, { type KanbanCardFormValues } from './features/CreateCardModal';
import KanbanBoard, { type KanbanCard, type KanbanStatus } from './features/KanbanBoard';

const useStyles = createStyles(({ css, token }) => ({
  container: css`
    overflow: auto;
    flex: 1;
    min-height: 0;
    padding-block-end: 8vh;
  `,
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
}));

const KANBAN_SWR_KEY = 'pantheon-kanban';

const PantheonKanbanPage = memo(() => {
  const { t } = useTranslation('pantheon');
  const { styles } = useStyles();
  const { message } = App.useApp();
  const pantheonKanbanEnabled = useServerConfigStore(
    (s) => featureFlagsSelectors(s).pantheonKanbanEnabled,
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<KanbanCard | undefined>(undefined);

  const { data, error, isLoading, mutate } = useSWR<KanbanCard[]>(
    pantheonKanbanEnabled === false ? null : [KANBAN_SWR_KEY],
    async () => {
      const rows = await lambdaClient.pantheon.kanban.list.query({});
      return rows.map((r): KanbanCard => ({
        agentId: r.agentId,
        description: r.description,
        id: r.id,
        priority: r.priority ?? 0,
        status: (r.status as KanbanStatus) ?? 'backlog',
        title: r.title,
      }));
    },
    { revalidateOnFocus: true },
  );

  const openCreate = useCallback(() => {
    setEditing(undefined);
    setModalOpen(true);
  }, []);

  const handleEdit = useCallback((card: KanbanCard) => {
    setEditing(card);
    setModalOpen(true);
  }, []);

  const handleSubmit = useCallback(
    async (values: KanbanCardFormValues, cardId?: string) => {
      try {
        if (cardId) {
          await lambdaClient.pantheon.kanban.update.mutate({
            description: values.description ?? null,
            id: cardId,
            priority: values.priority ?? 0,
            status: values.status ?? 'backlog',
            title: values.title,
          });
        } else {
          await lambdaClient.pantheon.kanban.create.mutate({
            description: values.description ?? null,
            priority: values.priority ?? 0,
            status: values.status ?? 'backlog',
            title: values.title,
          });
        }
        await mutate();
      } catch (err) {
        console.error('[kanban.submit]', err);
        message.error(t('kanban.error'));
        throw err;
      }
    },
    [mutate, message, t],
  );

  const handleStatusChange = useCallback(
    async (card: KanbanCard, status: KanbanStatus) => {
      try {
        await lambdaClient.pantheon.kanban.update.mutate({ id: card.id, status });
        await mutate();
      } catch (err) {
        console.error('[kanban.statusChange]', err);
        message.error(t('kanban.error'));
      }
    },
    [mutate, message, t],
  );

  const handleDelete = useCallback(
    async (card: KanbanCard) => {
      try {
        await lambdaClient.pantheon.kanban.delete.mutate({ id: card.id });
        await mutate();
      } catch (err) {
        console.error('[kanban.delete]', err);
        message.error(t('kanban.error'));
      }
    },
    [mutate, message, t],
  );

  if (pantheonKanbanEnabled === false) {
    return (
      <Flexbox flex={1} height={'100%'}>
        <NavHeader />
        <Block className={styles.disabled} variant={'filled'}>
          {t('kanban.featureDisabled')}
        </Block>
      </Flexbox>
    );
  }

  return (
    <Flexbox flex={1} height={'100%'}>
      <NavHeader
        right={
          <Button icon={PlusIcon} type={'primary'} onClick={openCreate}>
            {t('kanban.addCard')}
          </Button>
        }
      />
      <Flexbox className={styles.header} gap={4}>
        <h2>{t('kanban.pageTitle')}</h2>
        <Text type={'secondary'}>{t('kanban.pageDescription')}</Text>
      </Flexbox>
      <Flexbox className={styles.container}>
        {isLoading && <Loading debugId="PantheonKanbanPage" />}
        {error && <div className={styles.error}>{t('kanban.error')}</div>}
        {!isLoading && !error && (
          <KanbanBoard
            cards={data ?? []}
            onDelete={handleDelete}
            onEdit={handleEdit}
            onStatusChange={handleStatusChange}
          />
        )}
      </Flexbox>
      <CreateCardModal
        initialValues={
          editing
            ? {
                description: editing.description ?? '',
                id: editing.id,
                priority: editing.priority ?? 0,
                status: editing.status,
                title: editing.title,
              }
            : undefined
        }
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onSubmit={handleSubmit}
      />
    </Flexbox>
  );
});

PantheonKanbanPage.displayName = 'PantheonKanbanPage';

export default PantheonKanbanPage;
