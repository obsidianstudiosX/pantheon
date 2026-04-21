import { describe, expect, it } from 'vitest';

import { normaliseVrmBinding } from '../normalise';

describe('normaliseVrmBinding', () => {
  it('returns null for null input', () => {
    expect(normaliseVrmBinding(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(normaliseVrmBinding(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(normaliseVrmBinding('')).toBeNull();
    expect(normaliseVrmBinding('   ')).toBeNull();
  });

  it('wraps a bare string in { url } (legacy form)', () => {
    expect(normaliseVrmBinding('/branding/vrm/foo.vrm')).toEqual({
      url: '/branding/vrm/foo.vrm',
    });
  });

  it('converts object form snake_case → camelCase and passes through known keys', () => {
    const raw = {
      offset_y: 0.1,
      pose_idle: 'idle-02',
      scale: 1.25,
      stage: '#goddess-council:pantheon',
      url: '/branding/vrm/foo.vrm',
      voice_tts: { provider: 'openai', voice: 'nova' },
    };
    expect(normaliseVrmBinding(raw)).toEqual({
      offsetY: 0.1,
      poseIdle: 'idle-02',
      scale: 1.25,
      stage: '#goddess-council:pantheon',
      url: '/branding/vrm/foo.vrm',
      voiceTts: { provider: 'openai', voice: 'nova' },
    });
  });

  it('drops unknown fields and omits optional ones that are missing', () => {
    const raw = {
      debug_only: true,
      url: '/branding/vrm/foo.vrm',
    } as const;
    const result = normaliseVrmBinding(raw as never);
    expect(result).toEqual({ url: '/branding/vrm/foo.vrm' });
  });

  it('returns null for an object lacking the required url field', () => {
    // @ts-expect-error — intentional bad shape
    expect(normaliseVrmBinding({ pose_idle: 'idle-01' })).toBeNull();
  });
});
