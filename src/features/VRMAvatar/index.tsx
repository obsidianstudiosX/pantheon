'use client';

import { Card } from 'antd';
import type { CSSProperties } from 'react';
import { memo } from 'react';

import { useVRMBinding } from './hooks/useVRMBinding';

export interface VRMAvatarProps {
  /**
   * Agent manifest slug (e.g. `rapi-advocate`).
   */
  agentSlug: string;
  /**
   * Pixel size of the square viewport. Defaults to 96.
   */
  size?: number;
  /**
   * Whether to run the idle animation loop once lobe-vidol is wired.
   * Accepted today as a forwards-compatible prop but not yet consumed.
   */
  idle?: boolean;
  style?: CSSProperties;
}

/**
 * SCAFFOLD ONLY — placeholder `<VRMAvatar>` component.
 *
 * TODO(#sub-project-5):
 *   - Replace the Card placeholder with lobe-vidol's Viewer component.
 *     The lobe-vidol npm dep has *not* been added yet (PR-level decision);
 *     the real import will live in `./components/Scene.tsx` and be wrapped
 *     in `React.lazy` + IntersectionObserver (see the plan under
 *     docs/superpowers/plans/2026-04-22-vrm-avatars-plan.md, Task 5).
 *   - Wire @lobehub/tts voice selection using `binding.voiceTts`.
 *   - Mount stage background via `binding.stage` (see STAGE_REGISTRY).
 *
 * Current behaviour (scaffold):
 *   - Renders a small Card showing `VRM: <slug>` when a binding resolves.
 *   - Shows a "No VRM binding" fallback message when useVRMBinding returns null.
 */
const VRMAvatar = memo<VRMAvatarProps>(({ agentSlug, size = 96, idle: _idle, style }) => {
  const { data, isLoading } = useVRMBinding(agentSlug);

  const containerStyle: CSSProperties = {
    alignItems: 'center',
    display: 'flex',
    height: size,
    justifyContent: 'center',
    width: size,
    ...style,
  };

  if (isLoading) {
    return (
      <Card
        data-testid={`vrm-avatar-loading-${agentSlug}`}
        loading
        size="small"
        style={containerStyle}
      />
    );
  }

  if (!data) {
    return (
      <Card
        data-testid={`vrm-avatar-fallback-${agentSlug}`}
        size="small"
        style={containerStyle}
        title="No VRM binding"
      >
        {agentSlug}
      </Card>
    );
  }

  return (
    <Card
      data-testid={`vrm-avatar-${agentSlug}`}
      size="small"
      style={containerStyle}
      title={`VRM: ${agentSlug}`}
    >
      {/* TODO: replace with <Scene url={data.url} poseIdle={data.poseIdle} /> */}
      <code style={{ fontSize: 11 }}>{data.url}</code>
    </Card>
  );
});

VRMAvatar.displayName = 'VRMAvatar';

export default VRMAvatar;
export { VRMAvatar };
