/**
 * Process-local concurrency cap for animated VRM scenes.
 *
 * Design §6: "Hard cap of 2 concurrently-animated VRMs." When more avatars
 * want to animate than the cap allows, late-comers fall back to the
 * IntersectionObserver placeholder until a slot frees up.
 *
 * This is intentionally a module-scoped Zustand-free mini-store. A full
 * Zustand slice lives in the plan (Task 9 `store/avatar/concurrencySlice`)
 * but the functionality we need for capping is trivial enough that we
 * avoid adding another store slice ahead of real integration.
 *
 * The hook returns `[granted, release]`:
 *   - `granted === true` means the caller owns a slot and may mount the scene.
 *   - `release()` frees the slot; also invoked automatically on unmount.
 */

import { useEffect, useState } from 'react';

export const VRM_CONCURRENCY_CAP = 2;

interface SlotRegistry {
  active: Set<string>;
  waiters: Array<(granted: boolean) => void>;
}

// Single process-wide registry. Exported for tests to reset.
export const __vrmRegistry: SlotRegistry = {
  active: new Set<string>(),
  waiters: [],
};

export function __resetVrmRegistry(): void {
  __vrmRegistry.active.clear();
  __vrmRegistry.waiters.length = 0;
}

function tryAcquire(ownerId: string): boolean {
  if (__vrmRegistry.active.has(ownerId)) return true;
  if (__vrmRegistry.active.size < VRM_CONCURRENCY_CAP) {
    __vrmRegistry.active.add(ownerId);
    return true;
  }
  return false;
}

function release(ownerId: string): void {
  const had = __vrmRegistry.active.delete(ownerId);
  if (!had) return;
  // Wake one waiter.
  const next = __vrmRegistry.waiters.shift();
  if (next) next(true);
}

/**
 * Request a concurrency slot. `wanted=false` means "I am not visible /
 * eligible", which releases any slot the caller held. Safe to toggle.
 */
export function useVRMSlot(ownerId: string, wanted: boolean): boolean {
  const [granted, setGranted] = useState<boolean>(() => (wanted ? tryAcquire(ownerId) : false));

  useEffect(() => {
    if (!wanted) {
      release(ownerId);
      setGranted(false);
      return;
    }

    if (tryAcquire(ownerId)) {
      setGranted(true);
      return () => release(ownerId);
    }

    // Enqueue and wait.
    let cancelled = false;
    const resolve = (ok: boolean) => {
      if (cancelled) return;
      if (ok && tryAcquire(ownerId)) setGranted(true);
    };
    __vrmRegistry.waiters.push(resolve);

    return () => {
      cancelled = true;
      release(ownerId);
      const idx = __vrmRegistry.waiters.indexOf(resolve);
      if (idx >= 0) __vrmRegistry.waiters.splice(idx, 1);
    };
  }, [ownerId, wanted]);

  return granted;
}
