'use client';

import { Card, Empty } from 'antd';

export interface ToolExecutionPanelProps {
  agentSlug: string;
}

/**
 * SCAFFOLD — Tool Execution Panel (read-only live view).
 *
 * Eventually renders:
 *   - live stream of current/recent MCP tool invocations for this agent
 *   - each row: tool_name, started_at, duration_ms, status (ok/err), arg summary
 *   - filters: time window (last 5m / 1h / 24h), status, tool
 *   - data source: /api/pantheon/v1/traces?agent=:slug (SSE or poll every 5s)
 *
 * Shown on agentProfile slot (not agentEdit) — it's a runtime observability tab.
 */
export function ToolExecutionPanel({ agentSlug }: ToolExecutionPanelProps) {
  return (
    <Card title="Tool Execution">
      <Empty description={`TODO: live MCP tool invocation feed for ${agentSlug}`} />
    </Card>
  );
}

export default ToolExecutionPanel;
