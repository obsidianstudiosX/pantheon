'use client';

import { Card, Empty } from 'antd';

import { usePantheonAgent } from '../../hooks/usePantheonAgent';

export interface CanonPanelProps {
  agentSlug: string;
}

/**
 * SCAFFOLD — Canon Panel.
 *
 * Eventually renders:
 *   - source (BD2 / Nikke / Original) as header Tag
 *   - character + outfit + series
 *   - agency (e.g. "Counters", "Valkyrja", "Pantheon-Original")
 *   - role (Advocate, Command, Dispatcher, ...)
 *   - emoji + vibe as accent elements
 *
 * Data source: usePantheonAgent(slug).canon.
 */
export function CanonPanel({ agentSlug }: CanonPanelProps) {
  const { data, isLoading } = usePantheonAgent(agentSlug);
  if (isLoading) return <Card loading title="Canon" />;
  return (
    <Card title="Canon">
      <Empty
        description={
          data
            ? `TODO: render source/character/outfit/agency/role for ${agentSlug}`
            : 'No canon data'
        }
      />
    </Card>
  );
}

export default CanonPanel;
