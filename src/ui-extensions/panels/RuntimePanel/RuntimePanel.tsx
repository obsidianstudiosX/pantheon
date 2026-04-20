'use client';

import { Alert, Card, Descriptions, Tag } from 'antd';
import type { CSSProperties } from 'react';

import { usePantheonAgent } from '../../hooks/usePantheonAgent';
import type { RuntimeTier } from '../../types/manifest';

export interface RuntimePanelProps {
  agentSlug: string;
  style?: CSSProperties;
}

const tierColors: Record<RuntimeTier, string> = {
  hermes: 'gold',
  openclaw: 'blue',
  pantheon: 'purple',
  sandbox: 'default',
};

const codeStyle: CSSProperties = {
  background: 'rgba(0,0,0,0.04)',
  borderRadius: 4,
  fontFamily:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  fontSize: 12,
  padding: '2px 6px',
};

export function RuntimePanel({ agentSlug, style }: RuntimePanelProps) {
  const { data, isLoading, error } = usePantheonAgent(agentSlug);

  if (isLoading) {
    return <Card loading style={style} title="Runtime" />;
  }

  if (error) {
    return (
      <Card style={style} title="Runtime">
        <Alert
          showIcon
          title={`Failed to load runtime: ${error instanceof Error ? error.message : String(error)}`}
          type="error"
        />
      </Card>
    );
  }

  if (!data) return null;

  const { runtime } = data;
  const tierColor = tierColors[runtime.tier] ?? 'default';

  return (
    <Card style={style} title="Runtime">
      <Descriptions column={1} size="small">
        <Descriptions.Item label="Tier">
          <Tag color={tierColor}>{runtime.tier}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Implementation">{runtime.implementation}</Descriptions.Item>
        <Descriptions.Item label="Version">
          {runtime.version ?? runtime.implementation_version}
        </Descriptions.Item>
        <Descriptions.Item label="Fleet Path">
          <code style={codeStyle}>{runtime.fleet_path}</code>
        </Descriptions.Item>
        <Descriptions.Item label="Systemd Unit">
          <code style={codeStyle}>{runtime.systemd_unit}</code>
        </Descriptions.Item>
      </Descriptions>
      <Alert
        showIcon
        style={{ marginTop: 12 }}
        title="Tier changes require operator approval and trigger fleet migration."
        type="info"
      />
    </Card>
  );
}

export default RuntimePanel;
