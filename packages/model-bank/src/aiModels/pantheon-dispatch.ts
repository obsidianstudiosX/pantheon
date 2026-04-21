// Pantheon — Dispatch (meta-model). Routes every turn through the standard
// pipeline (vesper → dorothy → target → eclipse → diana → ...).
// Spec: docs/superpowers/specs/2026-04-22-gateway-design.md §D3
import type { AIChatModelCard } from '../types/aiModel';

const pantheonDispatchChatModels: AIChatModelCard[] = [
  {
    abilities: { functionCall: true, reasoning: true },
    contextWindowTokens: 200_000,
    description:
      'Pantheon Dispatch auto-routes every turn through the standard agent pipeline (Vesper classify → target agent → Eclipse verify → Diana review). Use this when you want the fleet to pick the right agent for you.',
    displayName: 'Pantheon (Auto-route)',
    enabled: true,
    id: 'pantheon-dispatch',
    maxOutput: 8192,
    type: 'chat',
  },
];

export const allModels = [...pantheonDispatchChatModels];

export default allModels;
