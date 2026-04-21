'use client';

import { Card } from 'antd';
import type { CSSProperties } from 'react';
import { lazy, memo, Suspense, useId, useRef } from 'react';

import { useVRMSlot } from './concurrency';
import { useInViewport } from './hooks/useInViewport';
import { usePrefersReducedMotion } from './hooks/usePrefersReducedMotion';
import { useVRMBinding } from './hooks/useVRMBinding';

export { VRM_CONCURRENCY_CAP } from './concurrency';
export { useVRMBinding } from './hooks/useVRMBinding';
export { normaliseVrmBinding } from './normalise';
export { resolveStageUrl, STAGE_REGISTRY } from './stages';
export type { VRMBinding } from './types';

/**
 * Lazy-loaded 3D scene. Kept in a separate chunk so the initial shell
 * bundle never pulls three.js / @pixiv/three-vrm (design §6).
 *
 * The `Scene` file today is a shell with a commented-out real import —
 * once the npm deps are approved and installed, the diff lands inside
 * `components/Scene.tsx` without touching this file.
 */
const Scene = lazy(() => import('./components/Scene'));

export interface VRMAvatarProps {
  /**
   * Agent manifest slug (e.g. `rapi-advocate`).
   */
  agentSlug: string;
  /**
   * When true, never mount the 3D scene — render the 2D placeholder only.
   * Used by the agent-select grid to auto-downgrade off-hover tiles.
   */
  forcePlaceholder?: boolean;
  /**
   * Whether to run the idle animation loop once lobe-vidol is wired.
   * Accepted today as a forwards-compatible prop.
   */
  idle?: boolean;
  /**
   * Pixel size of the square viewport. Defaults to 96.
   */
  size?: number;
  style?: CSSProperties;
  /**
   * Density variant. `chip` turns off heavy camera controls and drops to a
   * smaller scene (spec §3). The exported `<VRMAvatarChip>` below applies
   * this variant plus a default `size=40`.
   */
  variant?: 'default' | 'chip';
}

/**
 * <VRMAvatar>
 *
 * Renders a per-agent 3D portrait. Behaviour:
 *
 *   1. `useVRMBinding(slug)` resolves the binding via the resolver API.
 *   2. Until the avatar enters the viewport (+256 px rootMargin), render
 *      the 2D Card placeholder.
 *   3. If the user has `prefers-reduced-motion: reduce`, render a
 *      static-frame scene (no animation loop) even when eligible.
 *   4. Enforce the concurrent-animation cap (2 visible scenes max across
 *      the whole app — design §6); excess instances render the placeholder.
 *
 * All heavy deps live behind `React.lazy()` so the initial chunk is
 * untouched. The real lobe-vidol Viewer plugs into `components/Scene.tsx`
 * once npm deps are approved.
 */
const VRMAvatar = memo<VRMAvatarProps>(
  ({ agentSlug, size = 96, idle = true, variant = 'default', forcePlaceholder = false, style }) => {
    const { data, isLoading } = useVRMBinding(agentSlug);
    const mountRef = useRef<HTMLDivElement | null>(null);
    const reducedMotion = usePrefersReducedMotion();
    const inView = useInViewport(mountRef, { disabled: forcePlaceholder ? false : undefined });
    const slotOwnerId = useId();

    const wantsSlot = Boolean(data) && inView && !forcePlaceholder && !reducedMotion;
    const hasSlot = useVRMSlot(slotOwnerId, wantsSlot);

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
        <div ref={mountRef} style={containerStyle}>
          <Card
            loading
            data-testid={`vrm-avatar-loading-${agentSlug}`}
            size="small"
            style={containerStyle}
          />
        </div>
      );
    }

    if (!data) {
      return (
        <div ref={mountRef} style={containerStyle}>
          <Card
            data-testid={`vrm-avatar-fallback-${agentSlug}`}
            size="small"
            style={containerStyle}
            title="No VRM binding"
          >
            {agentSlug}
          </Card>
        </div>
      );
    }

    // Binding resolved. Decide between the 2D Card placeholder and the 3D
    // scene. Placeholder wins when any of: forcePlaceholder, not-in-view,
    // concurrency cap exhausted.
    const shouldMountScene = inView && !forcePlaceholder && hasSlot;

    if (!shouldMountScene) {
      return (
        <div ref={mountRef} style={containerStyle}>
          <Card
            data-testid={`vrm-avatar-${agentSlug}`}
            size="small"
            style={containerStyle}
            title={`VRM: ${agentSlug}`}
          >
            <code style={{ fontSize: 11 }}>{data.url}</code>
          </Card>
        </div>
      );
    }

    // Eligible to mount the 3D scene. If reduced-motion is set, pass
    // `staticFrame` so Scene renders a single still frame (no rAF loop).
    return (
      <div
        data-testid={`vrm-avatar-scene-${agentSlug}`}
        data-variant={variant}
        ref={mountRef}
        style={containerStyle}
      >
        <Suspense fallback={<Card loading size="small" style={containerStyle} />}>
          <Scene
            binding={data}
            idle={idle && !reducedMotion}
            size={size}
            staticFrame={reducedMotion}
          />
        </Suspense>
      </div>
    );
  },
);

VRMAvatar.displayName = 'VRMAvatar';

/**
 * Chip variant — small 32–48 px avatar for chat bubbles / mentions.
 * Internally a `<VRMAvatar>` with `variant="chip"` and a default size=40.
 */
export const VRMAvatarChip = memo<Omit<VRMAvatarProps, 'variant'>>(({ size = 40, ...rest }) => (
  <VRMAvatar {...rest} size={size} variant="chip" />
));
VRMAvatarChip.displayName = 'VRMAvatarChip';

export default VRMAvatar;
export { VRMAvatar };
