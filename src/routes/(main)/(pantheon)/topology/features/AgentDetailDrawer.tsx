'use client';

/**
 * Side drawer shown when the operator clicks a node in the topology DAG.
 * Purely read-only — surfaces the raw registry record (agent_id, role,
 * agency, port, description) plus badge state (PHI / verify).
 */
import { Drawer, Tag, Text } from '@lobehub/ui';
import { Descriptions } from 'antd';
import { createStyles } from 'antd-style';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import type { PantheonAgency } from '@/config/pantheon/registry';

export interface AgentDetail {
  agency: PantheonAgency;
  agentId: string;
  description: string;
  phiAware: boolean;
  port: number;
  role: string;
  verifyRequired: boolean;
}

interface AgentDetailDrawerProps {
  agent?: AgentDetail;
  onClose: () => void;
  open: boolean;
}

const useStyles = createStyles(({ css, token }) => ({
  description: css`
    padding-block-start: 8px;
    font-size: 13px;
    line-height: 1.5;
    color: ${token.colorTextSecondary};
  `,
  tagRow: css`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding-block-end: 12px;
  `,
}));

const AgentDetailDrawer = memo<AgentDetailDrawerProps>(({ agent, open, onClose }) => {
  const { t } = useTranslation('pantheon');
  const { styles } = useStyles();

  return (
    <Drawer
      onClose={onClose}
      open={open}
      placement={'right'}
      title={agent?.agentId ?? t('topology.drawer.title')}
      width={420}
    >
      {agent ? (
        <>
          <div className={styles.tagRow}>
            <Tag>{agent.agency}</Tag>
            <Tag>{agent.role}</Tag>
            {agent.phiAware && <Tag color={'magenta'}>{t('topology.drawer.phiAware')}</Tag>}
            {agent.verifyRequired && (
              <Tag color={'geekblue'}>{t('topology.drawer.verifyRequired')}</Tag>
            )}
          </div>
          <Descriptions column={1} size={'small'}>
            <Descriptions.Item label={t('topology.drawer.agentId')}>
              {agent.agentId}
            </Descriptions.Item>
            <Descriptions.Item label={t('topology.drawer.role')}>{agent.role}</Descriptions.Item>
            <Descriptions.Item label={t('topology.drawer.agency')}>
              {agent.agency}
            </Descriptions.Item>
            <Descriptions.Item label={t('topology.drawer.port')}>{agent.port}</Descriptions.Item>
          </Descriptions>
          <Text className={styles.description}>{agent.description}</Text>
        </>
      ) : (
        <Text type={'secondary'}>{t('topology.drawer.noSelection')}</Text>
      )}
    </Drawer>
  );
});

AgentDetailDrawer.displayName = 'AgentDetailDrawer';

export default AgentDetailDrawer;
