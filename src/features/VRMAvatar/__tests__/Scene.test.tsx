import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Scene, { PlaceholderScene } from '../components/Scene';
import type { VRMBinding } from '../types';

/**
 * The Scene.tsx module dynamic-imports `three` and `@pixiv/three-vrm`
 * inside its mount effect. In the happy-dom test environment there is no
 * WebGL context, so `mountThreeVrmScene` throws at the WebGL probe and the
 * `useEffect` catch branch flips `data-status` to `"error"`, which keeps
 * the 2D placeholder rendered. These tests lock that behaviour in.
 */

const binding: VRMBinding = {
  poseIdle: 'idle-01',
  stage: '#goddess-council:pantheon',
  url: '/branding/vrm/rapi-advocate.vrm',
};

describe('VRMScene', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the placeholder child initially (loading status)', () => {
    render(<Scene binding={binding} idle={false} size={96} />);
    const mount = screen.getByTestId('vrm-scene-mount');
    // Status is either "loading" on first paint or "error" after the catch
    // has run, depending on microtask ordering. Placeholder is present in
    // both cases until a real WebGL context is available.
    expect(mount).toBeTruthy();
    expect(screen.getByTestId('vrm-scene-placeholder')).toBeTruthy();
  });

  it('flips status to "error" in happy-dom (no WebGL) and keeps the placeholder', async () => {
    render(<Scene idle binding={binding} size={96} />);
    await waitFor(
      () => {
        const mount = screen.getByTestId('vrm-scene-mount');
        expect(mount.getAttribute('data-status')).toBe('error');
      },
      { timeout: 3000 },
    );
    // Placeholder must still be visible after the error branch.
    expect(screen.getByTestId('vrm-scene-placeholder')).toBeTruthy();
  });

  it('applies the requested size to the mount container', () => {
    render(<Scene binding={binding} idle={false} size={192} />);
    const mount = screen.getByTestId('vrm-scene-mount');
    expect(mount.style.width).toBe('192px');
    expect(mount.style.height).toBe('192px');
  });

  it('exposes the stage background on the placeholder when stage resolves', () => {
    render(<Scene staticFrame binding={binding} idle={false} size={96} />);
    const placeholder = screen.getByTestId('vrm-scene-placeholder');
    expect(placeholder.style.background).toContain('goddess-council.webp');
    // `aria-label` flips when staticFrame is true so screen readers
    // announce that motion is suppressed (reduced-motion branch).
    expect(placeholder.getAttribute('aria-label')).toBe('VRM avatar (static)');
    expect(placeholder.getAttribute('data-static')).toBe('true');
  });

  it('PlaceholderScene renders a gradient when stage is unknown', () => {
    const { container } = render(
      <PlaceholderScene
        binding={{ url: '/x.vrm' }}
        data-testid="vrm-scene-placeholder"
        idle={false}
        size={80}
      />,
    );
    const el = container.querySelector('[data-testid="vrm-scene-placeholder"]') as HTMLElement;
    expect(el).toBeTruthy();
    // Gradient is the fallback when resolveStageUrl returns undefined.
    expect(el.style.background).toContain('radial-gradient');
  });
});
