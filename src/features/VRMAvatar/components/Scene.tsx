'use client';

/**
 * 3D scene mount point.
 *
 * This is the ONLY file that will import `@pixiv/three-vrm` and `three`.
 * Keeping them isolated behind a `React.lazy()` boundary means the initial
 * chunk never pulls WebGL/VRM bytes — they load only when a `<VRMAvatar>`
 * intersects the viewport (design §6).
 *
 * Current state: skeleton that renders the stage background + a visual
 * placeholder. The three-vrm bits are wired behind a runtime capability
 * check so we can land the component shape without an installed dep.
 *
 * TODO(sub-project-5 Task 5, blocked on operator approval of npm deps):
 *   Replace `PlaceholderScene` with real three.js + @pixiv/three-vrm.
 *   The integration point is documented inline below.
 */

import type { CSSProperties } from 'react';
import { memo, useEffect, useRef } from 'react';

import { resolveStageUrl } from '../stages';
import type { VRMBinding } from '../types';

export interface SceneProps {
  'binding': VRMBinding;
  'data-testid'?: string;
  'idle': boolean;
  'size': number;
  /** When true the mount renders but does not animate (reduced-motion). */
  'staticFrame'?: boolean;
  'style'?: CSSProperties;
}

// ---------------------------------------------------------------------------
// STUB: three-vrm plug-in point
// ---------------------------------------------------------------------------
// Once `@pixiv/three-vrm` + `three` are approved and installed (plan Task 1
// npm deps, requires operator approval), replace the body of
// `mountThreeVrmScene` below with:
//
//   import * as THREE from 'three';
//   import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
//   import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
//
//   const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
//   const scene = new THREE.Scene();
//   const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
//   const loader = new GLTFLoader();
//   loader.register((parser) => new VRMLoaderPlugin(parser));
//   loader.load(binding.url, (gltf) => {
//     const vrm = gltf.userData.vrm;
//     VRMUtils.rotateVRM0(vrm);
//     scene.add(vrm.scene);
//     // Kick off the idle animation named binding.poseIdle || 'idle-01'.
//   });
//
// Also respect `staticFrame`: if true, render a single frame instead of
// driving requestAnimationFrame.
// ---------------------------------------------------------------------------

function mountThreeVrmScene(_container: HTMLElement, _props: SceneProps): () => void {
  // No-op placeholder until the deps are installed. Returns the cleanup
  // function (also a no-op today). See the block comment above for the
  // shape of the real implementation.
  return () => undefined;
}

const PlaceholderScene = memo<SceneProps>(({ binding, size, staticFrame, style, ...rest }) => {
  const stageUrl = resolveStageUrl(binding.stage);
  const testId = rest['data-testid'] ?? 'vrm-scene-placeholder';

  const containerStyle: CSSProperties = {
    alignItems: 'center',
    background: stageUrl
      ? `center / cover no-repeat url(${JSON.stringify(stageUrl)})`
      : 'radial-gradient(circle at 50% 35%, rgba(120,160,255,0.4), rgba(0,0,0,0.6))',
    borderRadius: 8,
    display: 'flex',
    flexDirection: 'column',
    height: size,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    width: size,
    ...style,
  };

  const labelStyle: CSSProperties = {
    background: 'rgba(0,0,0,0.45)',
    borderRadius: 4,
    color: 'white',
    fontFamily: 'monospace',
    fontSize: Math.max(9, Math.floor(size / 12)),
    padding: '2px 6px',
  };

  return (
    <div
      aria-label={staticFrame ? 'VRM avatar (static)' : 'VRM avatar'}
      data-static={staticFrame ? 'true' : 'false'}
      data-testid={testId}
      role="img"
      style={containerStyle}
    >
      <span style={labelStyle}>VRM</span>
    </div>
  );
});
PlaceholderScene.displayName = 'PlaceholderScene';

const Scene = memo<SceneProps>((props) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = mountRef.current;
    if (!host) return;
    // `mountThreeVrmScene` is a stub today. Once real three-vrm is wired it
    // will take ownership of `host` and return a teardown.
    return mountThreeVrmScene(host, props);
  }, [props]);

  // Until the real scene mounts anything into the div, render the
  // placeholder visual *inside* the same host so tests and prod visuals
  // agree. Once three-vrm lands, the placeholder will be conditionally
  // suppressed when `host.childElementCount > 0`.
  return (
    <div
      data-testid={props['data-testid'] ?? 'vrm-scene-mount'}
      ref={mountRef}
      style={{ height: props.size, width: props.size }}
    >
      <PlaceholderScene {...props} data-testid="vrm-scene-placeholder" />
    </div>
  );
});
Scene.displayName = 'VRMScene';

export default Scene;
export { PlaceholderScene };
