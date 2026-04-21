import { useEffect, useState } from 'react';

/**
 * Observes the `prefers-reduced-motion: reduce` media query.
 *
 * Design §6: when the user has asked the OS for reduced motion we skip the
 * VRM scene mount and render the 2D fallback. This hook is pure DOM — no
 * three.js / lobe-vidol dependency, so it is safe to import into happy-dom
 * tests and server components.
 *
 * SSR / environments without matchMedia: returns `false` (the default
 * "allow motion" branch). The VRM component will still be gated on
 * IntersectionObserver + the concurrency cap, so this is not a footgun.
 */
const MEDIA_QUERY = '(prefers-reduced-motion: reduce)';

export function usePrefersReducedMotion(): boolean {
  const [prefers, setPrefers] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(MEDIA_QUERY);
    setPrefers(mql.matches);

    const handler = (e: MediaQueryListEvent) => setPrefers(e.matches);
    // Modern browsers: addEventListener. Older Safari: addListener.
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    }
    (mql as unknown as { addListener: (fn: (e: MediaQueryListEvent) => void) => void }).addListener(
      handler,
    );
    return () => {
      (
        mql as unknown as { removeListener: (fn: (e: MediaQueryListEvent) => void) => void }
      ).removeListener(handler);
    };
  }, []);

  return prefers;
}
