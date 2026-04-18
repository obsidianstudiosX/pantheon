'use client';

import { Block, Button, Flexbox, Text } from '@lobehub/ui';
import { App, Select } from 'antd';
import { createStyles } from 'antd-style';
import { CameraIcon } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

import Loading from '@/components/Loading/BrandTextLoading';
import NavHeader from '@/features/NavHeader';
import { lambdaClient } from '@/libs/trpc/client';
import { featureFlagsSelectors, useServerConfigStore } from '@/store/serverConfig';

import CaptureModal, { type CaptureFormValues } from './features/CaptureModal';
import DiffModal from './features/DiffModal';
import SnapshotList, { type SnapshotRow } from './features/SnapshotList';

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
  emptyAgents: css`
    padding: 48px;
    color: ${token.colorTextTertiary};
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
  picker: css`
    padding-block: 0 12px;
    padding-inline: 16px;
  `,
}));

const AGENTS_SWR_KEY = 'pantheon-snapshots-agents';
const SNAPSHOTS_SWR_KEY = 'pantheon-snapshots';

interface AgentOption {
  id: string;
  title: string | null;
}

const PantheonSnapshotsPage = memo(() => {
  const { t } = useTranslation('pantheon');
  const { styles } = useStyles();
  const { message } = App.useApp();
  const pantheonSnapshotsEnabled = useServerConfigStore(
    (s) => featureFlagsSelectors(s).pantheonSnapshotsEnabled,
  );

  const [selectedAgentId, setSelectedAgentId] = useState<string | undefined>(undefined);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [diffIds, setDiffIds] = useState<{ aId: string; bId: string } | null>(null);

  const { data: agents, error: agentsError, isLoading: agentsLoading } = useSWR<AgentOption[]>(
    pantheonSnapshotsEnabled === false ? null : [AGENTS_SWR_KEY],
    async () => {
      const rows = await lambdaClient.agent.queryAgents.query({});
      return rows.map((r): AgentOption => ({ id: r.id, title: r.title ?? r.id }));
    },
    { revalidateOnFocus: true },
  );

  const effectiveAgentId = selectedAgentId ?? agents?.[0]?.id;

  const {
    data: snapshots,
    error: snapshotsError,
    isLoading: snapshotsLoading,
    mutate: mutateSnapshots,
  } = useSWR<SnapshotRow[]>(
    pantheonSnapshotsEnabled === false || !effectiveAgentId
      ? null
      : [SNAPSHOTS_SWR_KEY, effectiveAgentId],
    async () => {
      const rows = await lambdaClient.pantheon.snapshots.list.query({
        agentId: effectiveAgentId!,
      });
      return rows.map((r): SnapshotRow => ({
        agentId: r.agentId,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
        id: r.id,
        label: r.label,
        parentSnapshotId: r.parentSnapshotId ?? null,
      }));
    },
    { revalidateOnFocus: true },
  );

  const handleCapture = useCallback(
    async (values: CaptureFormValues) => {
      if (!effectiveAgentId) return;
      try {
        await lambdaClient.pantheon.snapshots.capture.mutate({
          agentId: effectiveAgentId,
          label: values.label,
          parentSnapshotId: values.parentSnapshotId ?? null,
        });
        await mutateSnapshots();
      } catch (err) {
        console.error('[snapshots.capture]', err);
        message.error(t('snapshots.error'));
        throw err;
      }
    },
    [effectiveAgentId, mutateSnapshots, message, t],
  );

  const handleRestore = useCallback(
    async (row: SnapshotRow) => {
      try {
        await lambdaClient.pantheon.snapshots.restore.mutate({ snapshotId: row.id });
        message.success(t('snapshots.restoreSuccess'));
        await mutateSnapshots();
      } catch (err) {
        console.error('[snapshots.restore]', err);
        message.error(t('snapshots.error'));
      }
    },
    [mutateSnapshots, message, t],
  );

  const handleDelete = useCallback(
    async (row: SnapshotRow) => {
      try {
        await lambdaClient.pantheon.snapshots.delete.mutate({ id: row.id });
        await mutateSnapshots();
      } catch (err) {
        console.error('[snapshots.delete]', err);
        message.error(t('snapshots.error'));
      }
    },
    [mutateSnapshots, message, t],
  );

  const handleDiff = useCallback((a: SnapshotRow, b: SnapshotRow) => {
    setDiffIds({ aId: a.id, bId: b.id });
  }, []);

  const agentOptions = useMemo(
    () =>
      (agents ?? []).map((a) => ({
        label: a.title ?? a.id,
        value: a.id,
      })),
    [agents],
  );

  if (pantheonSnapshotsEnabled === false) {
    return (
      <Flexbox flex={1} height={'100%'}>
        <NavHeader />
        <Block className={styles.disabled} variant={'filled'}>
          {t('snapshots.featureDisabled')}
        </Block>
      </Flexbox>
    );
  }

  return (
    <Flexbox flex={1} height={'100%'}>
      <NavHeader
        right={
          <Button
            disabled={!effectiveAgentId}
            icon={CameraIcon}
            type={'primary'}
            onClick={() => setCaptureOpen(true)}
          >
            {t('snapshots.capture')}
          </Button>
        }
      />
      <Flexbox className={styles.header} gap={4}>
        <h2>{t('snapshots.pageTitle')}</h2>
        <Text type={'secondary'}>{t('snapshots.pageDescription')}</Text>
      </Flexbox>
      <Flexbox className={styles.picker} gap={8} horizontal align={'center'}>
        <Text strong>{t('snapshots.selectAgent')}</Text>
        <Select
          loading={agentsLoading}
          onChange={(v: string) => setSelectedAgentId(v)}
          options={agentOptions}
          placeholder={t('snapshots.selectAgentPlaceholder')}
          style={{ minWidth: 280 }}
          value={effectiveAgentId}
        />
      </Flexbox>
      <Flexbox className={styles.container}>
        {agentsError && <div className={styles.error}>{t('snapshots.error')}</div>}
        {!agentsLoading && (!agents || agents.length === 0) && (
          <div className={styles.emptyAgents}>{t('snapshots.emptyAgents')}</div>
        )}
        {effectiveAgentId && snapshotsLoading && <Loading debugId="PantheonSnapshotsPage" />}
        {snapshotsError && <div className={styles.error}>{t('snapshots.error')}</div>}
        {effectiveAgentId && !snapshotsLoading && !snapshotsError && (
          <SnapshotList
            onDelete={handleDelete}
            onDiff={handleDiff}
            onRestore={handleRestore}
            rows={snapshots ?? []}
          />
        )}
      </Flexbox>
      <CaptureModal
        existingSnapshots={snapshots ?? []}
        open={captureOpen}
        onCancel={() => setCaptureOpen(false)}
        onSubmit={handleCapture}
      />
      {diffIds && (
        <DiffModal
          aId={diffIds.aId}
          bId={diffIds.bId}
          onClose={() => setDiffIds(null)}
          open={diffIds !== null}
        />
      )}
    </Flexbox>
  );
});

PantheonSnapshotsPage.displayName = 'PantheonSnapshotsPage';

export default PantheonSnapshotsPage;
