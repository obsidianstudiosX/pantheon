import { type RefObject, useEffect, useState } from 'react';

/**
 * Pure-DOM IntersectionObserver hook. Returns `true` once the observed
 * element has entered the viewport (or the provided root) with the given
 * margin; stays `true` for the lifetime of the component so we do not
 * churn the 3D mount point when scrolling.
 *
 * Used by `<VRMAvatar>` to defer loading the heavy VRM asset (design §6).
 *
 * If `IntersectionObserver` is unavailable (SSR, older happy-dom), we fall
 * back to "in viewport = true" so the caller's lazy branch still renders in
 * tests. Callers that care about the SSR story should check `typeof window`
 * before rendering the VRM tree (the main component does).
 */
export interface UseInViewportOptions {
  /** Force the "in-view" branch; used by tests and `mode === 'vrm'` overrides. */
  disabled?: boolean;
  rootMargin?: string;
  threshold?: number | number[];
}

export function useInViewport<T extends Element>(
  ref: RefObject<T | null>,
  { rootMargin = '256px', threshold = 0, disabled = false }: UseInViewportOptions = {},
): boolean {
  const [inView, setInView] = useState<boolean>(disabled);

  useEffect(() => {
    if (disabled) {
      setInView(true);
      return;
    }
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin, threshold },
    );
    observer.observe(node);

    return () => observer.disconnect();
  }, [ref, rootMargin, threshold, disabled]);

  return inView;
}
