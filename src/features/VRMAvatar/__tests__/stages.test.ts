import { describe, expect, it } from 'vitest';

import { DEFAULT_STAGE_URL, resolveStageUrl, STAGE_REGISTRY } from '../stages';

describe('stages', () => {
  it('exports at least one registry entry and a default', () => {
    expect(Object.keys(STAGE_REGISTRY).length).toBeGreaterThan(0);
    expect(DEFAULT_STAGE_URL).toMatch(/\.webp$/);
  });

  it('looks up a known Matrix room alias', () => {
    expect(resolveStageUrl('#goddess-council:pantheon')).toBe(
      '/branding/stages/goddess-council.webp',
    );
  });

  it('returns undefined for an unknown alias', () => {
    expect(resolveStageUrl('#nope:pantheon')).toBeUndefined();
  });

  it('passes through explicit absolute / rooted URLs', () => {
    expect(resolveStageUrl('https://cdn.example/bg.webp')).toBe('https://cdn.example/bg.webp');
    expect(resolveStageUrl('/custom/path.webp')).toBe('/custom/path.webp');
  });

  it('returns undefined for null / empty input', () => {
    expect(resolveStageUrl(null)).toBeUndefined();
    expect(resolveStageUrl(undefined)).toBeUndefined();
    expect(resolveStageUrl('')).toBeUndefined();
  });
});
