// Next.js 15 middleware entry. Upstream LobeHub v2 has a comprehensive
// `defineConfig()` helper in `@/libs/next/proxy/define-config` that returns
// the middleware function — but upstream ships without the actual
// `middleware.ts` entry file, which leaves the middleware never registered
// (middleware-manifest.json ends up as `{"middleware": {}}`). Our fork wires
// it up so:
//   1. SPA paths (anything not in `nextjsOnlyRoutes`) are rewritten to
//      `/spa/[variants]/[...path]` so direct-URL access (bookmarks, deep
//      links) works for our 5 Pantheon routes (and upstream routes too).
//   2. Better Auth session redirects to /signin instead of falling through
//      to a NEXT_REDIRECT error page.
import { defineConfig } from '@/libs/next/proxy/define-config';

const { middleware: wired } = defineConfig();

export const middleware = wired;

export const config = {
  matcher: [
    // Match every path except Next.js static assets, build artifacts, and
    // common static files so middleware can apply its SPA/auth logic.
    '/((?!_next/static|_next/image|_next/data|favicon\\.ico|favicon-.*\\.ico|apple-touch-icon\\.png|robots\\.txt|sitemap.*\\.xml|manifest\\.webmanifest|icons/|avatars/|screenshots/|og/|_spa/|_dangerous_local_dev_proxy).*)',
  ],
};
