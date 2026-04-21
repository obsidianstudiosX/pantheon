import { describe, expect, it, vi } from 'vitest';

import { resolveVrmBinding } from '../server/resolver';

describe('resolveVrmBinding', () => {
  it('returns static path when mode=static, ignoring manifest', async () => {
    const result = await resolveVrmBinding('rapi-advocate', {
      fetchManifestVrm: async () => {
        throw new Error('should not be called');
      },
      mode: 'static',
      signUrl: async () => ({ expiresAt: '', url: '' }),
    });
    expect(result).toEqual({ url: '/branding/vrm/rapi-advocate.vrm' });
  });

  it('returns null when manifest has no vrm field', async () => {
    const result = await resolveVrmBinding('no-avatar-agent', {
      fetchManifestVrm: async () => null,
      mode: 'minio',
      signUrl: async () => ({ expiresAt: '', url: '' }),
    });
    expect(result).toBeNull();
  });

  it('passes through an absolute URL without signing', async () => {
    const signUrl = vi.fn();
    const result = await resolveVrmBinding('zenith-strategy', {
      fetchManifestVrm: async () => 'https://cdn.example/foo.vrm',
      mode: 'minio',
      signUrl: signUrl as never,
    });
    expect(result?.url).toBe('https://cdn.example/foo.vrm');
    expect(signUrl).not.toHaveBeenCalled();
  });

  it('passes through a rooted /branding/... path without signing', async () => {
    const signUrl = vi.fn();
    const result = await resolveVrmBinding('rapi-advocate', {
      fetchManifestVrm: async () => '/branding/vrm/rapi-advocate.vrm',
      mode: 'minio',
      signUrl: signUrl as never,
    });
    expect(result?.url).toBe('/branding/vrm/rapi-advocate.vrm');
    expect(signUrl).not.toHaveBeenCalled();
  });

  it('invokes the signer for a bare MinIO key and preserves metadata', async () => {
    const signUrl = vi.fn(async (path: string) => ({
      expiresAt: '2030-01-01T00:00:00Z',
      url: `https://minio.example/signed?key=${encodeURIComponent(path)}`,
    }));
    const result = await resolveVrmBinding('teresse-clinical', {
      fetchManifestVrm: async () => ({
        pose_idle: 'idle-03',
        stage: '#clinical-chamber:pantheon',
        url: 'vrm/teresse.vrm',
      }),
      mode: 'minio',
      signUrl,
    });
    expect(signUrl).toHaveBeenCalledWith('vrm/teresse.vrm');
    expect(result).toEqual({
      expiresAt: '2030-01-01T00:00:00Z',
      poseIdle: 'idle-03',
      stage: '#clinical-chamber:pantheon',
      url: 'https://minio.example/signed?key=vrm%2Fteresse.vrm',
    });
  });
});
