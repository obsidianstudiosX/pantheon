'use client';

import { Block, Button, Flexbox, Text } from '@lobehub/ui';
import { App, Tabs } from 'antd';
import { createStyles } from 'antd-style';
import { PlusIcon } from 'lucide-react';
import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

import Loading from '@/components/Loading/BrandTextLoading';
import NavHeader from '@/features/NavHeader';
import { lambdaClient } from '@/libs/trpc/client';
import { featureFlagsSelectors, useServerConfigStore } from '@/store/serverConfig';

import ResourceGrid, { type NPResource } from './features/ResourceGrid';
import ResourceModal, { type NPResourceFormValues } from './features/ResourceModal';
import SubmissionList, {
  type NPSubmission,
  type NPSubmissionStatus,
} from './features/SubmissionList';
import SubmissionModal, { type NPSubmissionFormValues } from './features/SubmissionModal';

const PORTAL_URL = 'https://portal.mindbridgepsych.org/';

const SUBMISSIONS_SWR_KEY = 'pantheon-np-submissions';
const RESOURCES_SWR_KEY = 'pantheon-np-resources';

const useStyles = createStyles(({ css, token }) => ({
  container: css`
    overflow: auto;
    flex: 1;
    min-height: 0;
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
  iframe: css`
    display: block;

    width: 100%;
    height: 100%;
    min-height: 600px;
    border: 0;
  `,
  iframeWrap: css`
    display: flex;
    flex: 1;

    min-height: 0;
    padding: 0;

    background: ${token.colorBgLayout};
  `,
  tabs: css`
    flex: 1;
    min-height: 0;

    .ant-tabs-nav {
      margin: 0;
      padding-inline: 16px;
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

const PantheonNPPage = memo(() => {
  const { t } = useTranslation('pantheon');
  const { styles } = useStyles();
  const { message } = App.useApp();
  const pantheonNPEnabled = useServerConfigStore((s) => featureFlagsSelectors(s).pantheonNPEnabled);

  const [activeTab, setActiveTab] = useState<'submissions' | 'portal' | 'resources'>('submissions');

  // ---- Submissions state ------------------------------------------------
  const [submissionModalOpen, setSubmissionModalOpen] = useState(false);
  const [editingSubmission, setEditingSubmission] = useState<NPSubmission | undefined>(undefined);

  const {
    data: submissions,
    error: submissionsError,
    isLoading: submissionsLoading,
    mutate: mutateSubmissions,
  } = useSWR<NPSubmission[]>(
    pantheonNPEnabled === false ? null : [SUBMISSIONS_SWR_KEY],
    async () => {
      const rows = await lambdaClient.pantheon.np.submissions.list.query();
      return rows.map(
        (r): NPSubmission => ({
          createdAt: r.createdAt,
          externalTrackingId: r.externalTrackingId,
          id: r.id,
          patientInitials: r.patientInitials,
          status: (r.status as NPSubmissionStatus) ?? 'draft',
          submissionText: r.submissionText,
          submittedBy: r.submittedBy,
          title: r.title,
          updatedAt: r.updatedAt,
        }),
      );
    },
    { revalidateOnFocus: true },
  );

  const openCreateSubmission = useCallback(() => {
    setEditingSubmission(undefined);
    setSubmissionModalOpen(true);
  }, []);

  const handleEditSubmission = useCallback((row: NPSubmission) => {
    setEditingSubmission(row);
    setSubmissionModalOpen(true);
  }, []);

  const handleSubmissionSubmit = useCallback(
    async (values: NPSubmissionFormValues, id?: string) => {
      try {
        if (id) {
          await lambdaClient.pantheon.np.submissions.update.mutate({
            externalTrackingId: values.externalTrackingId || null,
            id,
            patientInitials: values.patientInitials || null,
            status: values.status ?? 'draft',
            submissionText: values.submissionText || null,
            submittedBy: values.submittedBy || null,
            title: values.title,
          });
        } else {
          await lambdaClient.pantheon.np.submissions.create.mutate({
            externalTrackingId: values.externalTrackingId || null,
            patientInitials: values.patientInitials || null,
            status: values.status ?? 'draft',
            submissionText: values.submissionText || null,
            submittedBy: values.submittedBy || null,
            title: values.title,
          });
        }
        await mutateSubmissions();
      } catch (err) {
        console.error('[np.submissions.submit]', err);
        message.error(t('np.submissions.error'));
        throw err;
      }
    },
    [mutateSubmissions, message, t],
  );

  const handleSubmissionStatusChange = useCallback(
    async (row: NPSubmission, status: NPSubmissionStatus) => {
      try {
        await lambdaClient.pantheon.np.submissions.update.mutate({ id: row.id, status });
        await mutateSubmissions();
      } catch (err) {
        console.error('[np.submissions.status]', err);
        message.error(t('np.submissions.error'));
      }
    },
    [mutateSubmissions, message, t],
  );

  const handleSubmissionDelete = useCallback(
    async (row: NPSubmission) => {
      try {
        await lambdaClient.pantheon.np.submissions.delete.mutate({ id: row.id });
        await mutateSubmissions();
      } catch (err) {
        console.error('[np.submissions.delete]', err);
        message.error(t('np.submissions.error'));
      }
    },
    [mutateSubmissions, message, t],
  );

  // ---- Resources state --------------------------------------------------
  const [resourceModalOpen, setResourceModalOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<NPResource | undefined>(undefined);

  const {
    data: resources,
    error: resourcesError,
    isLoading: resourcesLoading,
    mutate: mutateResources,
  } = useSWR<NPResource[]>(
    pantheonNPEnabled === false ? null : [RESOURCES_SWR_KEY],
    async () => {
      const rows = await lambdaClient.pantheon.np.resources.list.query();
      return rows.map(
        (r): NPResource => ({
          createdBy: r.createdBy,
          description: r.description,
          id: r.id,
          sortOrder: r.sortOrder,
          tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
          title: r.title,
          url: r.url,
        }),
      );
    },
    { revalidateOnFocus: true },
  );

  const openCreateResource = useCallback(() => {
    setEditingResource(undefined);
    setResourceModalOpen(true);
  }, []);

  const handleEditResource = useCallback((res: NPResource) => {
    setEditingResource(res);
    setResourceModalOpen(true);
  }, []);

  const handleResourceSubmit = useCallback(
    async (values: NPResourceFormValues, id?: string) => {
      try {
        if (id) {
          await lambdaClient.pantheon.np.resources.update.mutate({
            description: values.description || null,
            id,
            sortOrder: values.sortOrder ?? 0,
            tags: values.tags ?? [],
            title: values.title,
            url: values.url,
          });
        } else {
          await lambdaClient.pantheon.np.resources.create.mutate({
            description: values.description || null,
            sortOrder: values.sortOrder ?? 0,
            tags: values.tags ?? [],
            title: values.title,
            url: values.url,
          });
        }
        await mutateResources();
      } catch (err) {
        console.error('[np.resources.submit]', err);
        message.error(t('np.resources.error'));
        throw err;
      }
    },
    [mutateResources, message, t],
  );

  const handleResourceDelete = useCallback(
    async (res: NPResource) => {
      try {
        await lambdaClient.pantheon.np.resources.delete.mutate({ id: res.id });
        await mutateResources();
      } catch (err) {
        console.error('[np.resources.delete]', err);
        message.error(t('np.resources.error'));
      }
    },
    [mutateResources, message, t],
  );

  // ---- Render -----------------------------------------------------------
  if (pantheonNPEnabled === false) {
    return (
      <Flexbox flex={1} height={'100%'}>
        <NavHeader />
        <Block className={styles.disabled} variant={'filled'}>
          {t('np.featureDisabled')}
        </Block>
      </Flexbox>
    );
  }

  const headerAction =
    activeTab === 'submissions' ? (
      <Button icon={PlusIcon} type={'primary'} onClick={openCreateSubmission}>
        {t('np.submissions.addButton')}
      </Button>
    ) : activeTab === 'resources' ? (
      <Button icon={PlusIcon} type={'primary'} onClick={openCreateResource}>
        {t('np.resources.addButton')}
      </Button>
    ) : null;

  return (
    <Flexbox flex={1} height={'100%'}>
      <NavHeader right={headerAction} />
      <Flexbox className={styles.header} gap={4}>
        <h2>{t('np.pageTitle')}</h2>
        <Text type={'secondary'}>{t('np.pageDescription')}</Text>
      </Flexbox>
      <Tabs
        activeKey={activeTab}
        className={styles.tabs}
        destroyOnHidden={false}
        items={[
          {
            children: (
              <Flexbox className={styles.container}>
                {submissionsLoading && <Loading debugId="PantheonNPSubmissions" />}
                {submissionsError && (
                  <div className={styles.error}>{t('np.submissions.error')}</div>
                )}
                {!submissionsLoading && !submissionsError && (
                  <SubmissionList
                    rows={submissions ?? []}
                    onDelete={handleSubmissionDelete}
                    onEdit={handleEditSubmission}
                    onStatusChange={handleSubmissionStatusChange}
                  />
                )}
              </Flexbox>
            ),
            key: 'submissions',
            label: t('np.tabs.submissions'),
          },
          {
            children: (
              <div className={styles.iframeWrap}>
                <iframe
                  allow={'clipboard-read; clipboard-write'}
                  className={styles.iframe}
                  referrerPolicy={'no-referrer'}
                  sandbox={
                    'allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox'
                  }
                  src={PORTAL_URL}
                  title={t('np.portal.iframeTitle')}
                />
              </div>
            ),
            key: 'portal',
            label: t('np.tabs.portal'),
          },
          {
            children: (
              <Flexbox className={styles.container}>
                {resourcesLoading && <Loading debugId="PantheonNPResources" />}
                {resourcesError && <div className={styles.error}>{t('np.resources.error')}</div>}
                {!resourcesLoading && !resourcesError && (
                  <ResourceGrid
                    rows={resources ?? []}
                    onDelete={handleResourceDelete}
                    onEdit={handleEditResource}
                  />
                )}
              </Flexbox>
            ),
            key: 'resources',
            label: t('np.tabs.resources'),
          },
        ]}
        onChange={(key) => setActiveTab(key as typeof activeTab)}
      />

      <SubmissionModal
        open={submissionModalOpen}
        initialValues={
          editingSubmission
            ? {
                externalTrackingId: editingSubmission.externalTrackingId ?? '',
                id: editingSubmission.id,
                patientInitials: editingSubmission.patientInitials ?? '',
                status: editingSubmission.status,
                submissionText: editingSubmission.submissionText ?? '',
                submittedBy: editingSubmission.submittedBy ?? '',
                title: editingSubmission.title,
              }
            : undefined
        }
        onCancel={() => setSubmissionModalOpen(false)}
        onSubmit={handleSubmissionSubmit}
      />

      <ResourceModal
        open={resourceModalOpen}
        initialValues={
          editingResource
            ? {
                description: editingResource.description ?? '',
                id: editingResource.id,
                sortOrder: editingResource.sortOrder ?? 0,
                tags: editingResource.tags ?? [],
                title: editingResource.title,
                url: editingResource.url,
              }
            : undefined
        }
        onCancel={() => setResourceModalOpen(false)}
        onSubmit={handleResourceSubmit}
      />
    </Flexbox>
  );
});

PantheonNPPage.displayName = 'PantheonNPPage';

export default PantheonNPPage;
