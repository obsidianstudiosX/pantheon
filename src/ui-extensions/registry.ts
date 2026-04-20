import type { ComponentType } from 'react';

import { CanonPanel } from './panels/CanonPanel';
import { CostAuditPanel } from './panels/CostAuditPanel';
import { MatrixPanel } from './panels/MatrixPanel';
import { MemoryPanel } from './panels/MemoryPanel';
import { OrchestrationPanel } from './panels/OrchestrationPanel';
import { PolicyPanel } from './panels/PolicyPanel';
import { RuntimePanel } from './panels/RuntimePanel';
import { ToolExecutionPanel } from './panels/ToolExecutionPanel';

export type ExtensionGate = 'operator' | `feature:${string}`;

export interface ExtensionSlot {
  component: ComponentType<{ agentSlug: string }>;
  gate?: ExtensionGate;
  id: string;
  label: string;
  /** Lower order renders first. Leave gaps of 10 for future insertions. */
  order: number;
}

export type ExtensionSlotId = 'agentEdit' | 'agentProfile';

export const extensionSlots: Record<ExtensionSlotId, ExtensionSlot[]> = {
  agentEdit: [
    { component: RuntimePanel, gate: 'operator', id: 'runtime', label: 'Runtime', order: 100 },
    {
      component: OrchestrationPanel,
      id: 'orchestration',
      label: 'Orchestration',
      order: 110,
    },
    { component: PolicyPanel, gate: 'operator', id: 'policy', label: 'Policy', order: 120 },
    { component: MemoryPanel, id: 'memory', label: 'Memory', order: 130 },
    {
      component: MatrixPanel,
      gate: 'feature:matrix',
      id: 'matrix',
      label: 'Matrix',
      order: 140,
    },
    { component: CanonPanel, id: 'canon', label: 'Canon', order: 150 },
  ],
  agentProfile: [
    {
      component: ToolExecutionPanel,
      id: 'tool-execution',
      label: 'Tool Execution',
      order: 100,
    },
    {
      component: CostAuditPanel,
      gate: 'operator',
      id: 'cost-audit',
      label: 'Cost Audit',
      order: 110,
    },
  ],
};

export interface ExtensionGateContext {
  /** Whether the current viewer has operator privileges. */
  isOperator: boolean;
  /** Feature flag evaluator. Return true for enabled flags (e.g. 'matrix'). */
  hasFeature: (flag: string) => boolean;
}

/** Filter a slot list by gating predicate. Pure helper — no React imports. */
export function filterSlots(slots: ExtensionSlot[], ctx: ExtensionGateContext): ExtensionSlot[] {
  return slots
    .filter((slot) => {
      if (!slot.gate) return true;
      if (slot.gate === 'operator') return ctx.isOperator;
      if (slot.gate.startsWith('feature:')) {
        return ctx.hasFeature(slot.gate.slice('feature:'.length));
      }
      return true;
    })
    .slice()
    .sort((a, b) => a.order - b.order);
}

export function getSlots(id: ExtensionSlotId): ExtensionSlot[] {
  return extensionSlots[id] ?? [];
}
