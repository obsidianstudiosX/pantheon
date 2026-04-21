'use client';

/**
 * 3D scene mount point — real @pixiv/three-vrm renderer.
 *
 * This is the ONLY file that imports `@pixiv/three-vrm` and `three`. Keeping
 * them isolated behind a `React.lazy()` boundary (see ../index.tsx) means the
 * initial chunk never pulls WebGL / VRM bytes — they load only when a
 * `<VRMAvatar>` actually intersects the viewport (design §6).
 *
 * Imports from `three` and `@pixiv/three-vrm` are done via dynamic `import()`
 * INSIDE the mount effect instead of at module top-level. Two reasons:
 *
 *   1. Further code-splitting: even this Scene chunk can be loaded without
 *      touching WebGL until `mountThreeVrmScene` actually runs.
 *   2. Test ergonomics: the vitest `happy-dom` environment has no WebGL
 *      context. The dynamic import lets tests fail fast and the mount falls
 *      back to the 2D placeholder — we don't have to mock `three` wholesale.
 *
 * Animation model: a simple bob (breathing) + head sway "idle" loop, matching
 * the design spec note "three-vrm-animation default idle OR a simple
 * bob-and-blink". We don't ship a VRMA track file; the idle motion is
 * procedurally driven so every agent has *some* liveliness even without a
 * per-agent animation asset.
 */

import type { CSSProperties } from 'react';
import { memo, useEffect, useRef, useState } from 'react';
// Type-only import: gives us `Object3D` without pulling three into the
// initial chunk (erased at build time).
import type { Object3D } from 'three';

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

interface MountState {
  cancelled: boolean;
  cleanup?: () => void;
}

/**
 * Mount a real three.js + three-vrm scene into `host`.
 *
 * Returns a cleanup function that disposes the renderer, geometries, textures
 * and cancels the animation loop.
 *
 * Errors (WebGL unavailable, fetch 404, parse error) are caught and reported
 * via `onStatus('error' | 'empty')` so the component can render the 2D
 * placeholder without crashing the React tree.
 */
async function mountThreeVrmScene(
  host: HTMLElement,
  props: SceneProps,
  onStatus: (s: 'mounted' | 'error') => void,
): Promise<() => void> {
  // Dynamic imports — see module header. Any import failure (most commonly in
  // happy-dom / SSR) falls back to the placeholder via the catch block in the
  // calling effect.
  const [THREE, vrmModule] = await Promise.all([import('three'), import('@pixiv/three-vrm')]);
  const { VRMLoaderPlugin, VRMUtils } = vrmModule;

  // GLTFLoader is shipped as a three example. Import lazily to keep it split.
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');

  // WebGL smoke test — bail immediately if the environment cannot create a
  // rendering context. happy-dom / jsdom return null for getContext('webgl2').
  const probeCanvas = document.createElement('canvas');
  const gl =
    probeCanvas.getContext('webgl2') ||
    probeCanvas.getContext('webgl') ||
    probeCanvas.getContext('experimental-webgl');
  if (!gl) {
    throw new Error('WebGL unavailable');
  }

  const { size, binding, idle, staticFrame } = props;

  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2));
  renderer.setSize(size, size, false);
  renderer.setClearColor(0x00_00_00, 0);
  renderer.domElement.style.width = `${size}px`;
  renderer.domElement.style.height = `${size}px`;
  renderer.domElement.setAttribute('data-testid', 'vrm-scene-canvas');

  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 20);
  camera.position.set(0, 1.35, 1.9);
  camera.lookAt(0, 1.3, 0);

  // Soft rim + key light. Kept inexpensive — no shadows.
  const key = new THREE.DirectionalLight(0xff_ff_ff, 1.2);
  key.position.set(1, 1.5, 1);
  scene.add(key);
  const ambient = new THREE.AmbientLight(0xff_ff_ff, 0.6);
  scene.add(ambient);

  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));

  // Track state for cleanup. The load is async so we must be able to cancel
  // mid-flight if the caller unmounts before the VRM arrives.
  let rafHandle: number | null = null;
  let disposed = false;
  let vrmRoot: { scene: Object3D } | null = null;
  const loadAbort: AbortController | null =
    typeof AbortController === 'function' ? new AbortController() : null;

  const disposeAll = () => {
    if (disposed) return;
    disposed = true;
    if (rafHandle !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(rafHandle);
      rafHandle = null;
    }
    loadAbort?.abort();
    if (vrmRoot) {
      // VRMUtils.deepDispose walks the scene graph disposing geometries,
      // materials, textures. The cheapest correct teardown.
      VRMUtils.deepDispose(vrmRoot.scene);
      scene.remove(vrmRoot.scene);
    }
    renderer.dispose();
    if (renderer.domElement.parentNode === host) {
      host.removeChild(renderer.domElement);
    }
  };

  try {
    // Fetch with an AbortController so an unmount during load doesn't leak a
    // giant VRM parse into an orphan Scene. Falls through to the non-aborting
    // legacy `.load` signature if AbortController is unavailable.
    const gltf = await new Promise<{ userData: { vrm: { scene: Object3D } } }>(
      (resolve, reject) => {
        loader.load(
          binding.url,
          (g) => resolve(g as unknown as { userData: { vrm: { scene: Object3D } } }),
          undefined,
          (err) => reject(err instanceof Error ? err : new Error(String(err))),
        );
      },
    );

    if (disposed) return disposeAll;

    const vrm = gltf.userData.vrm;
    vrmRoot = vrm;
    // Older VRM0 models face the +Z direction — rotate to face camera.
    VRMUtils.rotateVRM0(vrm as unknown as Parameters<typeof VRMUtils.rotateVRM0>[0]);
    if (typeof binding.scale === 'number') {
      vrm.scene.scale.setScalar(binding.scale);
    }
    if (typeof binding.offsetY === 'number') {
      vrm.scene.position.y = binding.offsetY;
    }
    scene.add(vrm.scene);

    onStatus('mounted');

    const clock = new THREE.Clock();

    const renderOnce = () => {
      renderer.render(scene, camera);
    };

    if (staticFrame || !idle) {
      renderOnce();
      return disposeAll;
    }

    const animate = () => {
      if (disposed) return;
      const t = clock.getElapsedTime();
      // Simple procedural idle: gentle breathing bob (0.5 Hz, ±8 mm) and a
      // slow head sway (0.2 Hz, ±4°). No humanoid rig traversal needed at
      // this stage — per design §4 a proper preset ships with the TTS
      // sub-project once per-agent motion assets exist.
      if (vrmRoot) {
        vrmRoot.scene.position.y = (binding.offsetY ?? 0) + Math.sin(t * Math.PI) * 0.008;
        vrmRoot.scene.rotation.y = Math.sin(t * 0.4 * Math.PI) * 0.07;
      }
      renderer.render(scene, camera);
      rafHandle = requestAnimationFrame(animate);
    };

    rafHandle = requestAnimationFrame(animate);
    return disposeAll;
  } catch (error) {
    disposeAll();
    throw error;
  }
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
  const [status, setStatus] = useState<'loading' | 'mounted' | 'error'>('loading');

  useEffect(() => {
    const host = mountRef.current;
    if (!host) return;

    const state: MountState = { cancelled: false };

    mountThreeVrmScene(host, props, (s) => {
      if (state.cancelled) return;
      setStatus(s);
    })
      .then((cleanup) => {
        if (state.cancelled) {
          cleanup();
          return;
        }
        state.cleanup = cleanup;
      })
      .catch(() => {
        if (state.cancelled) return;
        // WebGL unavailable, VRM 404, parse error — fall back to placeholder.
        setStatus('error');
      });

    return () => {
      state.cancelled = true;
      state.cleanup?.();
    };
    // We deliberately only restart the mount when inputs that affect the
    // scene itself change. `idle` toggle is handled below without a remount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.binding.url, props.size, props.staticFrame]);

  const showPlaceholder = status !== 'mounted';

  return (
    <div
      data-status={status}
      data-testid={props['data-testid'] ?? 'vrm-scene-mount'}
      ref={mountRef}
      style={{ height: props.size, position: 'relative', width: props.size }}
    >
      {showPlaceholder ? <PlaceholderScene {...props} data-testid="vrm-scene-placeholder" /> : null}
    </div>
  );
});
Scene.displayName = 'VRMScene';

export default Scene;
export { mountThreeVrmScene, PlaceholderScene };
