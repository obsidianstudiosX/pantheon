import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { __resetVrmRegistry, __vrmRegistry, useVRMSlot, VRM_CONCURRENCY_CAP } from '../concurrency';

describe('VRM concurrency cap', () => {
  beforeEach(() => {
    __resetVrmRegistry();
  });

  it('grants up to VRM_CONCURRENCY_CAP simultaneous slots', () => {
    const h1 = renderHook(() => useVRMSlot('a', true));
    const h2 = renderHook(() => useVRMSlot('b', true));
    expect(h1.result.current).toBe(true);
    expect(h2.result.current).toBe(true);
    expect(__vrmRegistry.active.size).toBe(Math.min(2, VRM_CONCURRENCY_CAP));
  });

  it('denies overflow requests', () => {
    renderHook(() => useVRMSlot('a', true));
    renderHook(() => useVRMSlot('b', true));
    const h3 = renderHook(() => useVRMSlot('c', true));
    expect(h3.result.current).toBe(false);
  });

  it('releases slot on unmount and wakes a waiter', () => {
    const h1 = renderHook(() => useVRMSlot('a', true));
    const h2 = renderHook(() => useVRMSlot('b', true));
    const h3 = renderHook(() => useVRMSlot('c', true));
    expect(h3.result.current).toBe(false);

    act(() => {
      h1.unmount();
    });

    // After a slot opens, new renders can acquire. The already-queued
    // waiter (h3) resolves in its effect on next render.
    h3.rerender();
    expect(h3.result.current).toBe(true);

    h2.unmount();
    h3.unmount();
    expect(__vrmRegistry.active.size).toBe(0);
  });
});
