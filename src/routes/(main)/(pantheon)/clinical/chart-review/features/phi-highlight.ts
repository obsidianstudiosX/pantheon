/**
 * Client-side PHI highlighter. Mirrors PHI_PATTERNS from
 * `@/server/pantheon/hooks/phi-guard` so the textarea preview can visually
 * flag matches without a roundtrip. Kept in sync manually — the TS port in
 * phi-guard.ts is the source of truth, this file must be updated in lockstep
 * when patterns change.
 *
 * Output: HTML-escaped text with `<mark data-phi="<name>">…</mark>` spans
 * around each match. The React preview dangerouslySetInnerHTMLs it, which
 * is safe because (a) we escape the source text first and (b) every
 * replacement is a fixed-shape tag with only the pattern name injected,
 * and pattern names are compile-time-known strings.
 */

export const PHI_PATTERNS_CLIENT: ReadonlyArray<[string, RegExp]> = [
  ['mrn', /\bMRN[:\s#]*\d{4,}\b/gi],
  ['ssn', /\b\d{3}-\d{2}-\d{4}\b/g],
  [
    'dob',
    /\b(DOB|date of birth|born|D\.O\.B)[:\s.]+\d{1,2}[/-]\d{1,2}[/-](?:19|20)\d{2}\b/gi,
  ],
  ['phone', /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g],
  [
    'email',
    /\b[A-Za-z0-9._%+-]+@(?!example\.com|test\.com|pantheon)[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  ],
  ['npi', /\bNPI[:\s#]*\d{10}\b/gi],
  // patient_name: case-SENSITIVE by design.
  ['patient_name', /\b(patient|pt)[:\s]+[A-Z][a-z]+\s+[A-Z][a-z]+\b/g],
  [
    'full_name_with_title',
    /\b(Mr|Mrs|Ms|Miss|Dr|Prof)\.\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b/g,
  ],
  [
    'address',
    /\d{1,5}\s+[A-Z][a-z]+\s+(St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Ln|Lane|Ct|Court|Way|Pl|Place)\b/gi,
  ],
  [
    'insurance_id',
    /\b(policy|member|subscriber|group|plan)\s*#?\s*:?\s*[A-Z0-9]{6,}\b/gi,
  ],
  [
    'med_record_alt',
    /\b(MR#|Med\s*Rec|Chart\s*#|Acct\s*#)\s*:?\s*\d{4,}\b/gi,
  ],
  ['diagnosis_explicit', /\b(diagnos(?:is|ed with)|dx[:\s])/gi],
  [
    'med_dose',
    /\b[A-Z][a-z]+(?:ine|olol|pine|pril|statin|azole|illin)\s+\d+\s*mg\b/gi,
  ],
  ['age_gender', /\b\d{1,3}\s*y\/?o\s*[MmFf]\b/g],
];

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const escapeHtml = (s: string) => s.replaceAll(/[&<>"']/g, (c) => HTML_ESCAPES[c]);

/**
 * Return HTML with every PHI match wrapped in a `<mark>` element. Matches
 * are computed per-pattern, deduplicated by (start, end) offsets, then
 * layered onto the escaped source text in right-to-left order so earlier
 * offsets remain valid.
 */
export function highlightPhi(text: string): string {
  if (!text) return '';

  interface Hit {
    end: number;
    name: string;
    start: number;
  }
  const hits: Hit[] = [];
  for (const [name, pat] of PHI_PATTERNS_CLIENT) {
    // Fresh lastIndex per scan — patterns are global so we iterate.
    const re = new RegExp(pat.source, pat.flags);
    let m: RegExpExecArray | null;
    // eslint-disable-next-line no-cond-assign
    while ((m = re.exec(text)) !== null) {
      if (m[0].length === 0) {
        re.lastIndex += 1;
        continue;
      }
      hits.push({ end: m.index + m[0].length, name, start: m.index });
    }
  }
  if (hits.length === 0) return escapeHtml(text);

  // Sort descending so later splices don't shift earlier offsets.
  hits.sort((a, b) => b.start - a.start);

  // Drop overlapping hits — keep the first (outermost) one encountered in
  // the sorted-desc order.
  const kept: Hit[] = [];
  let lastStart = Infinity;
  for (const h of hits) {
    if (h.end <= lastStart) {
      kept.push(h);
      lastStart = h.start;
    }
  }

  let out = '';
  let cursor = text.length;
  for (const h of kept) {
    out = escapeHtml(text.slice(h.end, cursor)) + out;
    out =
      `<mark data-phi="${h.name}">${escapeHtml(text.slice(h.start, h.end))}</mark>` +
      out;
    cursor = h.start;
  }
  out = escapeHtml(text.slice(0, cursor)) + out;
  return out;
}
