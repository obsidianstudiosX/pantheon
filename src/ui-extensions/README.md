# Pantheon UI Extensions

React extension panels that render Pantheon-specific agent metadata on top of the
stock LobeHub shell. Wave G of platform consolidation per spec
`/opt/obsidian-pantheon/docs/superpowers/specs/2026-04-20-pantheon-platform-architecture.md`
§9.

## Slot pattern

A **slot** is a named location in the shell UI (e.g. the agent edit drawer, the
agent profile card) into which one or more Pantheon panels render. Panels are
declared in `registry.ts`:

```ts
export const extensionSlots: Record<ExtensionSlotId, ExtensionSlot[]> = {
  agentEdit: [
    { id: 'runtime', component: RuntimePanel, order: 100, gate: 'operator', label: 'Runtime' },
    // ...
  ],
  agentProfile: [
    { id: 'tool-execution', component: ToolExecutionPanel, order: 100, label: 'Tool Execution' },
    // ...
  ],
};
```

Each slot entry is:

| Field       | Meaning                                                                 |
|-------------|-------------------------------------------------------------------------|
| `id`        | Stable identifier (kebab-case), used as React key.                      |
| `component` | React component accepting `{ agentSlug: string }`.                      |
| `order`     | Render order, ascending. Leave gaps of 10 for future insertions.        |
| `gate`      | Optional — `'operator'` or `` `feature:<flag>` ``. See Feature gates.   |
| `label`     | Human-readable name (for a11y / tab titles).                            |

## Feature gates

Panels can be hidden from non-operators or behind feature flags. The registry
itself is inert — host integration code must call `filterSlots(slots, ctx)` with
an `ExtensionGateContext`:

```ts
import { filterSlots, getSlots } from '@/ui-extensions/registry';

const slots = filterSlots(getSlots('agentEdit'), {
  isOperator: currentUser.roles.includes('operator'),
  hasFeature: (flag) => flags.enabled(flag), // e.g. 'matrix', 'clinical'
});
```

Current gates in use:

- `operator` — hides panel from non-operator viewers (Runtime, Policy, Cost Audit).
- `feature:matrix` — hides panel when Matrix integration is retired / off.
- `feature:clinical` — reserved for PHI-aware panels; not yet used.

## Data source

Panels fetch data via `usePantheonAgent(agentSlug)`, which hits
`/api/pantheon/v1/agents/:slug`. The shell backend proxies
`/api/pantheon/*` → `http://127.0.0.1:18790/api/v1/*` (see
`src/app/(backend)/api/pantheon/[[...path]]/route.ts`). The control-plane API
(Wave E) authoritatively owns manifest data.

Override the upstream base URL with `PANTHEON_CONTROL_PLANE_URL` env var.

## Adding a new panel (3 steps)

1. **Create the component** under `src/ui-extensions/panels/YourPanel/index.tsx`.
   Accept `{ agentSlug: string }` and return a `<Card>` (use `antd` — matches
   shell convention).
2. **Register it** in `src/ui-extensions/registry.ts` by importing the component
   and appending an entry to the appropriate slot (`agentEdit` or
   `agentProfile`). Pick an `order` that places it where you want in the stack.
3. **Add a test** under `panels/YourPanel/__tests__/YourPanel.test.tsx`. Use the
   `RuntimePanel` test as a template — wrap in a `QueryClientProvider` and mock
   `globalThis.fetch` with a `Response` containing your fixture.

## Removing a stock LobeHub tab

The shell's `AgentSettingsContent.tsx` renders panels conditionally by
`ChatSettingsTabs` enum. There is no first-class removal extension point yet;
two options:

- **Hide** at the route layer by overriding the tab visibility in
  `src/store/global/initialState.ts` (feature flags).
- **Replace** by extending `AgentSettingsContent.tsx` to branch on Pantheon
  slots first and fall back to stock only when no extension claims the tab.

Proper extension point is tracked as a follow-up (spec §9 "slot pattern v2" —
requires upstream refactor to avoid maintenance burden on fork rebases).

## Injection point

Panels are NOT yet wired into the stock LobeHub agent edit UI. The intended
injection site is `src/features/AgentSetting/AgentSettingsContent.tsx`. A
minimal integration will add a new branch (e.g. a new `ChatSettingsTabs.Pantheon`
enum value) or interleave Pantheon slots into the `Meta` tab:

```tsx
import { filterSlots, getSlots } from '@/ui-extensions/registry';

// ...inside AgentSettingsContent, after existing tab branches:
{tab === ChatSettingsTabs.Meta && (
  <>
    <AgentMeta />
    {filterSlots(getSlots('agentEdit'), ctx).map(({ id, component: Panel }) => (
      <Panel agentSlug={agentSlug} key={id} />
    ))}
  </>
)}
```

This is intentionally left un-merged to avoid churn on LobeHub rebases until
Wave H decides on the final tab taxonomy.
