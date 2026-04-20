/**
 * Pantheon control-plane proxy.
 *
 * Forwards /api/pantheon/v1/* to the control-plane API at 127.0.0.1:18790
 * (Wave E). Used by UI extension panels via `usePantheonAgent` and future
 * cost/trace hooks.
 *
 * Shell does not authenticate in front of this proxy — the control-plane
 * validates operator scope via the forwarded Authorization header.
 */

const CONTROL_PLANE_BASE =
  process.env.PANTHEON_CONTROL_PLANE_URL ?? 'http://127.0.0.1:18790';

type RouteContext = { params: Promise<{ path?: string[] }> };

async function proxy(request: Request, ctx: RouteContext): Promise<Response> {
  const { path } = await ctx.params;
  const suffix = (path ?? []).join('/');
  const search = new URL(request.url).search;
  const target = `${CONTROL_PLANE_BASE}/api/v1/${suffix}${search}`;

  const headers = new Headers();
  const auth = request.headers.get('authorization');
  if (auth) headers.set('authorization', auth);
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);

  const init: RequestInit = {
    headers,
    method: request.method,
    redirect: 'manual',
  };
  if (!['GET', 'HEAD'].includes(request.method)) {
    init.body = request.body;
    // Next.js / fetch require duplex for streaming request bodies.
    (init as RequestInit & { duplex?: 'half' }).duplex = 'half';
  }

  try {
    const upstream = await fetch(target, init);
    const responseHeaders = new Headers();
    const upstreamContentType = upstream.headers.get('content-type');
    if (upstreamContentType) responseHeaders.set('content-type', upstreamContentType);
    return new Response(upstream.body, {
      headers: responseHeaders,
      status: upstream.status,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'control_plane_unreachable',
        message: error instanceof Error ? error.message : String(error),
        target,
      }),
      {
        headers: { 'content-type': 'application/json' },
        status: 502,
      },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
export const HEAD = proxy;
