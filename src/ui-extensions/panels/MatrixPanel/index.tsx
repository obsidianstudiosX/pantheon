'use client';

import { Card, Empty } from 'antd';

import { usePantheonAgent } from '../../hooks/usePantheonAgent';

export interface MatrixPanelProps {
  agentSlug: string;
}

/**
 * SCAFFOLD — Matrix Panel.
 *
 * Eventually renders:
 *   - Matrix identity (e.g. @rapi:pantheon.local) as copyable monospace
 *   - primary_room (Room ID + alias)
 *   - audit_room (operator-only audit feed room)
 *   - additional identities[] as secondary chip list
 *
 * Shown even when Matrix is retired (spec notes future revival); gated via
 * registry `gate: 'feature:matrix'` so operators can hide it entirely.
 *
 * Data source: usePantheonAgent(slug).matrix.
 */
export function MatrixPanel({ agentSlug }: MatrixPanelProps) {
  const { data, isLoading } = usePantheonAgent(agentSlug);
  if (isLoading) return <Card loading title="Matrix" />;
  return (
    <Card title="Matrix">
      <Empty
        description={
          data?.matrix
            ? `TODO: render identity, primary_room, audit_room for ${agentSlug}`
            : 'No Matrix binding'
        }
      />
    </Card>
  );
}

export default MatrixPanel;
