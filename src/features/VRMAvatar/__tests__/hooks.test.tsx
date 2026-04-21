import { renderHook } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useInViewport } from '../hooks/useInViewport';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

describe('useInViewport', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns true when disabled=true (forces in-view)', () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement | null>(null);
      return useInViewport(ref, { disabled: true });
    });
    expect(result.current).toBe(true);
  });

  it('returns true as fallback when IntersectionObserver is unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined as never);
    // Attach a real node so the effect runs to the fallback branch.
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement | null>(null);
      if (!ref.current && typeof document !== 'undefined') {
        ref.current = document.createElement('div');
      }
      return useInViewport(ref);
    });
    expect(result.current).toBe(true);
  });
});

describe('usePrefersReducedMotion', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns false when the media query does not match', () => {
    if (typeof window !== 'undefined') {
      vi.spyOn(window, 'matchMedia').mockImplementation(
        (query: string) =>
          ({
            addEventListener: () => undefined,
            addListener: () => undefined,
            dispatchEvent: () => true,
            matches: false,
            media: query,
            onchange: null,
            removeEventListener: () => undefined,
            removeListener: () => undefined,
          }) as unknown as MediaQueryList,
      );
    }
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });

  it('returns true when the media query matches', () => {
    if (typeof window === 'undefined') return;
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          addEventListener: () => undefined,
          addListener: () => undefined,
          dispatchEvent: () => true,
          matches: true,
          media: query,
          onchange: null,
          removeEventListener: () => undefined,
          removeListener: () => undefined,
        }) as unknown as MediaQueryList,
    );
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(true);
  });
});
