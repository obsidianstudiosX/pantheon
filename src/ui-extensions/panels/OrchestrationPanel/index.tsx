'use client';

import { Card, Empty } from 'antd';

import { usePantheonAgent } from '../../hooks/usePantheonAgent';

export interface OrchestrationPanelProps {
  agentSlug: string;
}

/**
 * SCAFFOLD — Orchestration Panel.
 *
 * Eventually renders:
 *   - dispatch_position (ordered badge: "Position 3 in bureaucracy_pipeline")
 *   - verify_required + ratifiers (list with "operator" / "eclipse-verifier" etc.)
 *   - handoff graph (receives_from / dispatches_to) — consider a small mermaid or
 *     antd Tree visual of the neighbors.
 *   - phi_aware and authority_scope badges.
 *
 * Data source: usePantheonAgent(slug).orchestration.
 */
export function OrchestrationPanel({ agentSlug }: OrchestrationPanelProps) {
  const { data, isLoading } = usePantheonAgent(agentSlug);
  if (isLoading) return <Card loading title="Orchestration" />;
  return (
    <Card title="Orchestration">
      <Empty
        description={
          data
            ? `TODO: render dispatch_position, verify_required, ratifiers, handoff graph for ${agentSlug}`
            : 'No orchestration data'
        }
      />
    </Card>
  );
}

export default OrchestrationPanel;
