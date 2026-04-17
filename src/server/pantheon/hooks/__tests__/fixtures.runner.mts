/**
 * Standalone fixture runner — mirrors fixtures.test.ts but works without
 * vitest. Runs via `node --experimental-strip-types path/to/this/file`.
 *
 * Exits 0 if 108/108 pass, 1 otherwise.
 *
 * Used because the fork's node_modules aren't installed in CI scratch
 * environments; `pnpm vitest run ...` is the preferred path once deps are
 * present (fixtures.test.ts uses the same fixture file and same TS modules,
 * so parity is trivial).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { scanCredentials } from '../credential-redactor.ts';
import { detectPhi } from '../phi-guard.ts';
import { isRefusal } from '../refusal-detector.ts';

interface Failure {
  suite: string;
  id: string;
  text: string;
  expected: unknown;
  got: unknown;
  notes: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// __tests__ is at src/server/pantheon/hooks/__tests__/
// fixture file copied to tests/phi-fixtures.json at repo root
const fixturesPath = join(__dirname, '..', '..', '..', '..', '..', 'tests', 'phi-fixtures.json');
const data = JSON.parse(readFileSync(fixturesPath, 'utf8')) as {
  phi_fixtures: Array<{ id: string; text: string; expected: string[]; notes?: string }>;
  credential_fixtures: Array<{ id: string; text: string; expected: string[]; notes?: string }>;
  refusal_fixtures: Array<{ id: string; text: string; expected: boolean; notes?: string }>;
};

const failures: Failure[] = [];
let total = 0;

function sortedSet<T>(arr: T[]): T[] {
  return [...new Set(arr)].sort();
}

for (const fx of data.phi_fixtures) {
  total++;
  const got = sortedSet(detectPhi(fx.text));
  const want = sortedSet(fx.expected);
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failures.push({
      suite: 'phi',
      id: fx.id,
      text: fx.text.slice(0, 80),
      expected: want,
      got,
      notes: fx.notes ?? '',
    });
  }
}

for (const fx of data.credential_fixtures) {
  total++;
  const got = sortedSet(scanCredentials(fx.text));
  const want = sortedSet(fx.expected);
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failures.push({
      suite: 'credential',
      id: fx.id,
      text: fx.text.slice(0, 80),
      expected: want,
      got,
      notes: fx.notes ?? '',
    });
  }
}

for (const fx of data.refusal_fixtures) {
  total++;
  const got = isRefusal(fx.text);
  const want = fx.expected;
  if (got !== want) {
    failures.push({
      suite: 'refusal',
      id: fx.id,
      text: fx.text.slice(0, 80),
      expected: want,
      got,
      notes: fx.notes ?? '',
    });
  }
}

const passed = total - failures.length;
console.log('\n=== Phase 3.2 TS Fixture Gate ===');
console.log(`Total fixtures: ${total}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failures.length}`);

if (failures.length > 0) {
  console.log('\n=== FAILURES ===');
  for (const f of failures) {
    console.log(`\n[${f.suite}] ${f.id}`);
    console.log(`  text: ${f.text}`);
    console.log(`  expected: ${JSON.stringify(f.expected)}`);
    console.log(`  got:      ${JSON.stringify(f.got)}`);
    console.log(`  notes: ${f.notes}`);
  }
  console.log(`\nFAIL: ${failures.length} fixture(s) out of ${total} failed.`);
  process.exit(1);
}

console.log(`\nPASS: ${passed}/${total} fixtures match Python ground truth.`);
process.exit(0);
