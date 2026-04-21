/**
 * VRM avatar resolver endpoint.
 *
 * GET /api/avatar/<slug>  →  { url, expiresAt?, poseIdle?, stage?, ... }
 * 404 when the agent has `vrm: null` or is unknown.
 *
 * Plan Task 3. Mirrors the `[[...path]]` proxy pattern (no Shell-level
 * auth; upstream control-plane enforces scope via forwarded headers).
 */

import { NextResponse } from 'next/server';

import {
  defaultFetchManifestVrm,
  defaultSignUrl,
  resolveVrmBinding,
} from '@/features/VRMAvatar/server/resolver';

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, ctx: RouteContext) {
  const { slug } = await ctx.params;

  if (!/^[a-z][a-z0-9-]*$/.test(slug)) {
    return NextResponse.json({ error: 'invalid_slug' }, { status: 400 });
  }

  try {
    const response = await resolveVrmBinding(slug, {
      fetchManifestVrm: defaultFetchManifestVrm,
      signUrl: defaultSignUrl,
    });
    if (!response) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        error: 'resolver_failed',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
