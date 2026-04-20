import { Space } from 'antd';
import { memo, useMemo } from 'react';

import { useStore } from '@/features/AgentSetting/store';

import { type ExtensionGateContext, type ExtensionSlotId, filterSlots, getSlots } from './registry';

interface Props {
  slotId: ExtensionSlotId;
}

const PantheonSlots = memo<Props>(({ slotId }) => {
  const agentSlug = useStore((s) => s.id);

  const ctx = useMemo<ExtensionGateContext>(
    () => ({
      hasFeature: () => false,
      isOperator: true,
    }),
    [],
  );

  const slots = useMemo(() => filterSlots(getSlots(slotId), ctx), [slotId, ctx]);

  if (!agentSlug || slots.length === 0) return null;

  return (
    <Space direction="vertical" size="middle" style={{ marginTop: 16, width: '100%' }}>
      {slots.map(({ component: Component, id }) => (
        <Component agentSlug={agentSlug} key={id} />
      ))}
    </Space>
  );
});

PantheonSlots.displayName = 'PantheonSlots';

export default PantheonSlots;
