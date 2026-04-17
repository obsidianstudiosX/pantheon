/**
 * Ground-truth fixture suite — validates the TS port against the 108-fixture
 * corpus at /opt/obsidian-pantheon/tests/phi-fixtures.json (mirrored to
 * tests/phi-fixtures.json in this fork).
 *
 * The Python reference (verify_phi_fixtures.py) passes 108/108 against
 * hooks.py. This TS port MUST also pass 108/108 or Phase 3.2 is blocked.
 *
 * Vitest-compatible (`pnpm vitest run`). A standalone Node runner lives at
 * ./fixtures.runner.mjs for environments without vitest installed.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { scanCredentials } from '../credential-redactor';
import { detectPhi } from '../phi-guard';
import { isRefusal } from '../refusal-detector';

interface PhiFixture {
  id: string;
  text: string;
  expected: string[];
  notes?: string;
}
interface CredFixture {
  id: string;
  text: string;
  expected: string[];
  notes?: string;
}
interface RefusalFixture {
  id: string;
  text: string;
  expected: boolean;
  notes?: string;
}
interface FixtureSet {
  phi_fixtures: PhiFixture[];
  credential_fixtures: CredFixture[];
  refusal_fixtures: RefusalFixture[];
}

// Fixture file copied from /opt/obsidian-pantheon/tests/phi-fixtures.json
// Resolve from this file so test runner cwd doesn't matter.
// Vitest supports both ESM (import.meta.url) and CJS (__dirname); use the
// URL form for forward compatibility.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesPath = join(__dirname, '..', '..', '..', '..', '..', 'tests', 'phi-fixtures.json');
const data: FixtureSet = JSON.parse(readFileSync(fixturesPath, 'utf8'));

function sortedSet<T>(arr: T[]): T[] {
  return [...new Set(arr)].sort();
}

describe('PHI fixtures (ground truth: Python hooks.py)', () => {
  for (const fx of data.phi_fixtures) {
    it(`${fx.id}: ${fx.notes ?? ''}`.trim(), () => {
      const got = sortedSet(detectPhi(fx.text));
      const want = sortedSet(fx.expected);
      expect(got).toEqual(want);
    });
  }
});

describe('Credential fixtures (ground truth: Python hooks.py)', () => {
  for (const fx of data.credential_fixtures) {
    it(`${fx.id}: ${fx.notes ?? ''}`.trim(), () => {
      const got = sortedSet(scanCredentials(fx.text));
      const want = sortedSet(fx.expected);
      expect(got).toEqual(want);
    });
  }
});

describe('Refusal fixtures (ground truth: Python hooks.py)', () => {
  for (const fx of data.refusal_fixtures) {
    it(`${fx.id}: ${fx.notes ?? ''}`.trim(), () => {
      expect(isRefusal(fx.text)).toBe(fx.expected);
    });
  }
});
