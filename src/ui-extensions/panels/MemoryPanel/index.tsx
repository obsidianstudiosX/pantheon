'use client';

import { Card, Empty } from 'antd';

import { usePantheonAgent } from '../../hooks/usePantheonAgent';

export interface MemoryPanelProps {
  agentSlug: string;
}

/**
 * SCAFFOLD — Memory Panel.
 *
 * Eventually renders:
 *   - shards (S/M/L/A/X/E/C) as color-coded Tag set with hover legend
 *   - ACL matrix (shard -> read/write groups)
 *   - retrieval_top_k with a small input preview
 *   - kb_bindings list (knowledge-base slugs; link to KB detail)
 *   - local_path (code-styled absolute path)
 *
 * Data source: usePantheonAgent(slug).memory.
 */
export function MemoryPanel({ agentSlug }: MemoryPanelProps) {
  const { data, isLoading } = usePantheonAgent(agentSlug);
  if (isLoading) return <Card loading title="Memory" />;
  return (
    <Card title="Memory">
      <Empty
        description={
          data
            ? `TODO: render shard bindings, ACL, top-k, KB bindings for ${agentSlug}`
            : 'No memory data'
        }
      />
    </Card>
  );
}

export default MemoryPanel;
