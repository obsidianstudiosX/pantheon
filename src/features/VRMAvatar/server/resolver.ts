/**
 * Server-side resolver for agent VRM bindings.
 *
 * Given an agent slug, looks up the manifest via the Pantheon control plane
 * and returns a `VRMResolveResponse` suitable for serving from the
 * `/api/avatar/[slug]` route. Handles three modes:
 *
 *   1. `NEXT_PUBLIC_VRM_RESOLVER=static` — skip control-plane and MinIO,
 *      return `/branding/vrm/<slug>.vrm`. Useful for local dev without the
 *      control plane running.
 *   2. Default — query control plane for the manifest's `vrm` field. If
 *      it's already a fully-qualified URL, return as-is. Otherwise
 *      compute a MinIO signed URL for the logical handle.
 *   3. 404 — the agent exists but has `vrm: null` or the field is missing.
 *
 * MinIO signing is kept behind a lightweight adapter so tests can inject a
 * fake without standing up S3.
 */

import { normaliseVrmBinding } from '../normalise';
import type { VRMBindingRaw, VRMResolveResponse } from '../types';

export interface ResolverDeps {
  /** GET the agent manifest's `vrm` field (raw wire shape). */
  fetchManifestVrm: (slug: string) => Promise<VRMBindingRaw>;
  /** Resolver mode (defaults to 'minio'). */
  mode?: 'static' | 'minio';
  /** Sign a MinIO handle or path. Returns the signed URL + expiry. */
  signUrl: (path: string) => Promise<{ url: string; expiresAt: string }>;
}

export async function resolveVrmBinding(
  slug: string,
  deps: ResolverDeps,
): Promise<VRMResolveResponse | null> {
  const mode =
    deps.mode ?? (process.env.NEXT_PUBLIC_VRM_RESOLVER === 'static' ? 'static' : 'minio');

  if (mode === 'static') {
    return { url: `/branding/vrm/${slug}.vrm` };
  }

  const raw = await deps.fetchManifestVrm(slug);
  const binding = normaliseVrmBinding(raw);
  if (!binding) return null;

  // If the URL already looks signed / absolute, pass through. Otherwise
  // treat it as a logical MinIO handle and sign it.
  const isAbsolute = /^(?:https?:)?\/\//.test(binding.url);
  if (isAbsolute) {
    return {
      expiresAt: binding.expiresAt,
      offsetY: binding.offsetY,
      poseIdle: binding.poseIdle,
      scale: binding.scale,
      stage: binding.stage,
      url: binding.url,
      voiceTts: binding.voiceTts,
    };
  }

  // For the `/branding/...` dev shape, avoid signing — the file is served
  // straight from `public/`. A real MinIO path (e.g. `s3://pantheon/vrm/...`
  // or a bare object key) triggers signing.
  if (binding.url.startsWith('/')) {
    return {
      expiresAt: binding.expiresAt,
      offsetY: binding.offsetY,
      poseIdle: binding.poseIdle,
      scale: binding.scale,
      stage: binding.stage,
      url: binding.url,
      voiceTts: binding.voiceTts,
    };
  }

  const signed = await deps.signUrl(binding.url);
  return {
    expiresAt: signed.expiresAt,
    offsetY: binding.offsetY,
    poseIdle: binding.poseIdle,
    scale: binding.scale,
    stage: binding.stage,
    url: signed.url,
    voiceTts: binding.voiceTts,
  };
}

/**
 * Default manifest fetcher — queries the Pantheon control plane at the
 * same base URL that the `[[...path]]` proxy uses.
 */
export async function defaultFetchManifestVrm(slug: string): Promise<VRMBindingRaw> {
  const base = process.env.PANTHEON_CONTROL_PLANE_URL ?? 'http://127.0.0.1:18790';
  const url = `${base}/api/v1/agents/${encodeURIComponent(slug)}`;
  try {
    const response = await fetch(url, { headers: { accept: 'application/json' } });
    if (!response.ok) return null;
    const payload = (await response.json()) as { vrm?: VRMBindingRaw };
    return payload?.vrm ?? null;
  } catch {
    return null;
  }
}

/**
 * Default MinIO/S3 signer. Uses `@aws-sdk/s3-request-presigner` which is
 * already a project dep. Returns a 5-minute-lifetime URL.
 *
 * The signer is lazily required so tests don't have to stand up AWS SDK.
 */
export async function defaultSignUrl(path: string): Promise<{ url: string; expiresAt: string }> {
  const bucket = process.env.PANTHEON_VRM_BUCKET ?? 'pantheon-vrm';
  const endpoint = process.env.PANTHEON_MINIO_ENDPOINT ?? 'http://127.0.0.1:9000';
  const accessKeyId = process.env.PANTHEON_MINIO_ACCESS_KEY ?? '';
  const secretAccessKey = process.env.PANTHEON_MINIO_SECRET_KEY ?? '';
  const region = process.env.PANTHEON_MINIO_REGION ?? 'us-east-1';
  const ttlSeconds = 300;

  const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');

  const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

  const client = new S3Client({
    credentials: { accessKeyId, secretAccessKey },
    endpoint,
    forcePathStyle: true,
    region,
  });
  const key = path.replace(/^\/+/, '');
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  const url = await getSignedUrl(client, command, { expiresIn: ttlSeconds });
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  return { url, expiresAt };
}
