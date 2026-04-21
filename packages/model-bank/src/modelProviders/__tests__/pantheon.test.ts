import { afterEach, describe, expect, it } from 'vitest';

import pantheonChatModels from '../../aiModels/pantheon';
import pantheonDispatchChatModels from '../../aiModels/pantheon-dispatch';
import PantheonProvider, { isPantheonProvidersEnabled } from '../pantheon';
import PantheonDispatchProvider from '../pantheon-dispatch';

describe('Pantheon — Direct provider', () => {
  it('has the expected id and name', () => {
    expect(PantheonProvider.id).toBe('pantheon');
    expect(PantheonProvider.name).toBe('Pantheon — Direct');
  });

  it('points at the gateway on 127.0.0.1:18790', () => {
    expect(PantheonProvider.settings.proxyUrl).toMatchObject({
      placeholder: 'http://127.0.0.1:18790/v1',
    });
  });

  it('uses the OpenAI-compatible SDK', () => {
    expect(PantheonProvider.settings.sdkType).toBe('openai');
  });

  it('has an empty legacy chatModels array (models come from aiModels/pantheon.ts)', () => {
    expect(PantheonProvider.chatModels).toEqual([]);
  });

  it('sets the connection check model to pantheon-dispatch', () => {
    expect(PantheonProvider.checkModel).toBe('pantheon-dispatch');
  });
});

describe('aiModels/pantheon model list', () => {
  it('contains at least one entry (26 expected when registry is reachable)', () => {
    expect(pantheonChatModels.length).toBeGreaterThanOrEqual(1);
  });

  it('every model id is prefixed with "pantheon-"', () => {
    for (const m of pantheonChatModels) {
      expect(m.id.startsWith('pantheon-')).toBe(true);
    }
  });

  it('every model has a non-empty displayName', () => {
    for (const m of pantheonChatModels) {
      expect(typeof m.displayName).toBe('string');
      expect((m.displayName ?? '').length).toBeGreaterThan(0);
    }
  });

  it('every model declares type "chat"', () => {
    for (const m of pantheonChatModels) {
      expect(m.type).toBe('chat');
    }
  });

  it('model ids are unique', () => {
    const ids = pantheonChatModels.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('Pantheon — Dispatch provider', () => {
  it('has id "pantheon-dispatch" and name "Pantheon — Dispatch"', () => {
    expect(PantheonDispatchProvider.id).toBe('pantheon-dispatch');
    expect(PantheonDispatchProvider.name).toBe('Pantheon — Dispatch');
  });

  it('points at the same gateway as the direct provider', () => {
    expect(PantheonDispatchProvider.settings.proxyUrl).toMatchObject({
      placeholder: 'http://127.0.0.1:18790/v1',
    });
    expect(PantheonDispatchProvider.settings.sdkType).toBe('openai');
  });

  it('exposes exactly one model: pantheon-dispatch', () => {
    expect(pantheonDispatchChatModels).toHaveLength(1);
    expect(pantheonDispatchChatModels[0].id).toBe('pantheon-dispatch');
  });
});

describe('isPantheonProvidersEnabled feature flag', () => {
  const originalFlag = process.env.NEXT_PUBLIC_PANTHEON_PROVIDERS;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalFlag === undefined) delete process.env.NEXT_PUBLIC_PANTHEON_PROVIDERS;
    else process.env.NEXT_PUBLIC_PANTHEON_PROVIDERS = originalFlag;
    if (originalNodeEnv === undefined) delete (process.env as Record<string, string>).NODE_ENV;
    else (process.env as Record<string, string>).NODE_ENV = originalNodeEnv;
  });

  it('returns true when NEXT_PUBLIC_PANTHEON_PROVIDERS=1', () => {
    process.env.NEXT_PUBLIC_PANTHEON_PROVIDERS = '1';
    (process.env as Record<string, string>).NODE_ENV = 'production';
    expect(isPantheonProvidersEnabled()).toBe(true);
  });

  it('returns false when NEXT_PUBLIC_PANTHEON_PROVIDERS=0 even in dev', () => {
    process.env.NEXT_PUBLIC_PANTHEON_PROVIDERS = '0';
    (process.env as Record<string, string>).NODE_ENV = 'development';
    expect(isPantheonProvidersEnabled()).toBe(false);
  });

  it('defaults to true in non-production when flag is unset', () => {
    delete process.env.NEXT_PUBLIC_PANTHEON_PROVIDERS;
    (process.env as Record<string, string>).NODE_ENV = 'development';
    expect(isPantheonProvidersEnabled()).toBe(true);
  });

  it('defaults to false in production when flag is unset', () => {
    delete process.env.NEXT_PUBLIC_PANTHEON_PROVIDERS;
    (process.env as Record<string, string>).NODE_ENV = 'production';
    expect(isPantheonProvidersEnabled()).toBe(false);
  });
});
