'use client';

/**
 * /pantheon/topology — React Flow v12 DAG of the 26-agent Pantheon fabric.
 *
 * Read-only visualization. Fabric (nodes + edges + dagre-positioned) is
 * fetched via tRPC (lambdaClient.pantheon.topology.getFabric) and rendered
 * with our custom AgentNode. Clicking a node opens AgentDetailDrawer.
 *
 * Guarded by `pantheonTopologyEnabled` feature flag.
 */
import '@xyflow/react/dist/style.css';

import { Block, Flexbox, Text } from '@lobehub/ui';
import {
  Background,
  Controls,
  type Edge,
  MiniMap,
  type Node,
  ReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import { createStyles } from 'antd-style';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

import Loading from '@/components/Loading/BrandTextLoading';
import NavHeader from '@/features/NavHeader';
import { lambdaClient } from '@/libs/trpc/client';
import { featureFlagsSelectors, useServerConfigStore } from '@/store/serverConfig';

import AgentDetailDrawer, { type AgentDetail } from './features/AgentDetailDrawer';
import AgentNode from './features/AgentNode';

const useStyles = createStyles(({ css, token }) => ({
  canvas: css`
    flex: 1;
    min-height: 0;

    .react-flow__attribution {
      display: none;
    }
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

const TOPOLOGY_SWR_KEY = 'pantheon-topology';

const NODE_TYPES = { agent: AgentNode } as const;

const PantheonTopologyPage = memo(() => {
  const { t } = useTranslation('pantheon');
  const { styles } = useStyles();
  const pantheonTopologyEnabled = useServerConfigStore(
    (s) => featureFlagsSelectors(s).pantheonTopologyEnabled,
  );

  const [selected, setSelected] = useState<AgentDetail | undefined>(undefined);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data, error, isLoading } = useSWR(
    pantheonTopologyEnabled === false ? null : [TOPOLOGY_SWR_KEY],
    async () => lambdaClient.pantheon.topology.getFabric.query(),
    { revalidateOnFocus: false },
  );

  const nodes = useMemo<Node[]>(() => (data?.nodes ?? []) as Node[], [data]);
  const edges = useMemo<Edge[]>(() => (data?.edges ?? []) as Edge[], [data]);

  const handleNodeClick = useCallback((_event: unknown, node: Node) => {
    const nd = node.data as unknown as AgentDetail;
    setSelected(nd);
    setDrawerOpen(true);
  }, []);

  if (pantheonTopologyEnabled === false) {
    return (
      <Flexbox flex={1} height={'100%'}>
        <NavHeader />
        <Block className={styles.disabled} variant={'filled'}>
          {t('topology.featureDisabled')}
        </Block>
      </Flexbox>
    );
  }

  return (
    <Flexbox flex={1} height={'100%'}>
      <NavHeader />
      <Flexbox className={styles.header} gap={4}>
        <h2>{t('topology.pageTitle')}</h2>
        <Text type={'secondary'}>{t('topology.pageDescription')}</Text>
      </Flexbox>
      {isLoading && <Loading debugId="PantheonTopologyPage" />}
      {error && <div className={styles.error}>{t('topology.error')}</div>}
      {!isLoading && !error && (
        <div className={styles.canvas}>
          <ReactFlowProvider>
            <ReactFlow
              edges={edges}
              edgesFocusable={false}
              fitView
              nodes={nodes}
              nodesConnectable={false}
              nodesDraggable={false}
              nodeTypes={NODE_TYPES}
              onNodeClick={handleNodeClick}
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={16} />
              <Controls showInteractive={false} />
              <MiniMap pannable zoomable />
            </ReactFlow>
          </ReactFlowProvider>
        </div>
      )}
      <AgentDetailDrawer
        agent={selected}
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
      />
    </Flexbox>
  );
});

PantheonTopologyPage.displayName = 'PantheonTopologyPage';

export default PantheonTopologyPage;
