'use client';

import { Card, Empty } from 'antd';

export interface CostAuditPanelProps {
  agentSlug: string;
}

/**
 * SCAFFOLD — Cost Audit Panel.
 *
 * Eventually renders:
 *   - per-agent token counts (input/output) aggregated from `pantheon_audit_trail` table
 *   - $ spend by day (line chart) + total for selected window
 *   - compare-to-ceiling indicator (agent.policy.cost_ceiling_daily_usd)
 *   - client-side aggregation — query /api/pantheon/v1/audit?agent=:slug&since=...
 *
 * Gated operator-only (PHI-adjacent, cost-sensitive).
 */
export function CostAuditPanel({ agentSlug }: CostAuditPanelProps) {
  return (
    <Card title="Cost Audit">
      <Empty description={`TODO: token/$ usage aggregation for ${agentSlug}`} />
    </Card>
  );
}

export default CostAuditPanel;
