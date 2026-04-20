'use client';

import { Card, Empty } from 'antd';

import { usePantheonAgent } from '../../hooks/usePantheonAgent';

export interface PolicyPanelProps {
  agentSlug: string;
}

/**
 * SCAFFOLD — Policy Panel.
 *
 * Eventually renders:
 *   - phi_guard_mode badge (strict / informational / disabled; red/yellow/grey)
 *   - review_gate toggle-style indicator
 *   - allowed_platforms as Tag list, blocked_platforms when present
 *   - cost_ceiling_daily_usd with spend bar (join against cost-audit query)
 *   - policy_bundle_refs as clickable chips (link to bundle detail)
 *
 * Data source: usePantheonAgent(slug).policy.
 */
export function PolicyPanel({ agentSlug }: PolicyPanelProps) {
  const { data, isLoading } = usePantheonAgent(agentSlug);
  if (isLoading) return <Card loading title="Policy" />;
  return (
    <Card title="Policy">
      <Empty
        description={
          data
            ? `TODO: render phi_guard_mode, review_gate, platform allowlist, cost ceiling for ${agentSlug}`
            : 'No policy data'
        }
      />
    </Card>
  );
}

export default PolicyPanel;
