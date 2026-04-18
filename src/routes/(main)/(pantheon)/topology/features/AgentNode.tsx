'use client';

/**
 * Custom React Flow v12 node for a single Pantheon agent.
 *
 * Visual contract (must match NODE_WIDTH/NODE_HEIGHT in
 * server/routers/lambda/pantheon/topology.ts so dagre positions don't drift
 * from what the user sees):
 *   width  = 220px
 *   height = 72px
 *
 * Color-by-agency:
 *   goddess   = #c9a84c  (gold)
 *   valisword = #b8b8d1  (silver-violet)
 *   command   = #8b2c3b  (blood red)
 *   scribe    = #3aa8a8  (teal) — applied when role === 'scribe'
 *   other     = gray     (mixed, memory, none, …)
 *
 * Badges:
 *   shield icon if data.phiAware === true
 *   lock icon   if data.verifyRequired === true
 */
import { Handle, type NodeProps, Position } from '@xyflow/react';
import { createStyles } from 'antd-style';
import { LockIcon, ShieldIcon } from 'lucide-react';
import { memo } from 'react';

import type { PantheonAgency } from '@/config/pantheon/registry';

export interface AgentNodeData {
  agency: PantheonAgency;
  agentId: string;
  description: string;
  phiAware: boolean;
  port: number;
  role: string;
  verifyRequired: boolean;
}

const AGENCY_COLORS: Record<string, string> = {
  command: '#8b2c3b',
  goddess: '#c9a84c',
  scribe: '#3aa8a8',
  valisword: '#b8b8d1',
};

const DEFAULT_COLOR = '#6b6b6b';

/** Resolve node accent color using agency first, scribe role as special-case. */
const resolveColor = (data: AgentNodeData): string => {
  if (data.role === 'scribe') return AGENCY_COLORS.scribe;
  return AGENCY_COLORS[data.agency] ?? DEFAULT_COLOR;
};

const useStyles = createStyles(({ css, token }, color: string) => ({
  accent: css`
    position: absolute;
    inset-block-start: 0;
    inset-inline-start: 0;
    inset-block-end: 0;

    width: 4px;

    background: ${color};
  `,
  badge: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;

    width: 18px;
    height: 18px;
    border-radius: 50%;

    color: ${token.colorTextBase};

    background: ${token.colorBgContainer};
  `,
  badgeRow: css`
    display: flex;
    flex-direction: row;
    gap: 4px;
  `,
  id: css`
    overflow: hidden;

    font-size: 13px;
    font-weight: 600;
    color: ${token.colorText};
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  node: css`
    position: relative;

    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: 4px;
    justify-content: center;

    box-sizing: border-box;
    width: 220px;
    height: 72px;
    padding: 8px 12px 8px 18px;
    border: 1px solid ${token.colorBorder};
    border-radius: 8px;

    background: ${token.colorBgElevated};
    box-shadow: 0 1px 2px rgb(0 0 0 / 12%);
  `,
  row: css`
    display: flex;
    flex-direction: row;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
  `,
  subtitle: css`
    overflow: hidden;

    font-size: 11px;
    color: ${token.colorTextSecondary};
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
}));

const AgentNode = memo<NodeProps>(({ data }) => {
  const agentData = data as unknown as AgentNodeData;
  const color = resolveColor(agentData);
  const { styles } = useStyles(color);

  return (
    <div className={styles.node}>
      <Handle position={Position.Left} type={'target'} />
      <span className={styles.accent} />
      <div className={styles.row}>
        <span className={styles.id}>{agentData.agentId}</span>
        <div className={styles.badgeRow}>
          {agentData.phiAware && (
            <span
              className={styles.badge}
              style={{ color }}
              title={'PHI-aware'}
            >
              <ShieldIcon size={12} strokeWidth={2.4} />
            </span>
          )}
          {agentData.verifyRequired && (
            <span
              className={styles.badge}
              style={{ color }}
              title={'Verify required'}
            >
              <LockIcon size={12} strokeWidth={2.4} />
            </span>
          )}
        </div>
      </div>
      <span className={styles.subtitle}>
        {agentData.role} · :{agentData.port}
      </span>
      <Handle position={Position.Right} type={'source'} />
    </div>
  );
});

AgentNode.displayName = 'AgentNode';

export default AgentNode;
