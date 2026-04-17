/**
 * Router — classifies a turn by (turn_type, stakes) from user text.
 *
 * Ported from hooks.py TYPE_RULES / STAKES_RULES / classify_type / classify_stakes
 * / apply_router (lines 86-130).
 *
 * Rule ordering is load-bearing — the first matching pattern wins. Fall-through
 * defaults: turn_type='general', stakes='low'.
 */
import type { Stakes, TurnEnvelope, TurnType } from './types';

// Source patterns carry Python re.I where applicable; all preserved as
// JS regex with the same flags for behavioral parity.

export const TYPE_RULES: ReadonlyArray<[TurnType, RegExp]> = [
  [
    'clinical-guide',
    /\b(dose|dosage|dosing|medication|drug|prescri|pharma|symptom|diagnos|treatment|therap|clinical|patient|vital|lab\s?result|blood\s?pressure|heart\s?rate|glucose|insulin|contraindic|side\s?effect|adverse|allerg|anaphyla)/i,
  ],
  [
    'clinical-review',
    /\b(review.*chart|chart\s?review|audit.*clinical|clinical.*audit|peer\s?review|case\s?review|quality.*measure|outcome.*measure|mortality|morbidity|readmission|evidence.based|guideline.*compliance)/i,
  ],
  [
    'research',
    /\b(research|study|trial|pubmed|meta.analysis|systematic\s?review|hypothesis|p[-\s]?value|confidence\s?interval|cohort|randomized|double.blind|placebo|literature|citation|journal|abstract|findings)/i,
  ],
  [
    'code',
    /\b(code|function|variable|class|import|export|async|await|typescript|javascript|python|rust|git|commit|merge|deploy|docker|kubernetes|k8s|api|endpoint|database|sql|query|debug|error|stack\s?trace|refactor|test|spec|lint)/i,
  ],
  [
    'config',
    /\b(config|setting|env|\.env|yaml|toml|json\s?config|nginx|apache|systemd|cron|hook|plugin|permission|auth|token|secret|key\s?rotation|ssl|cert)/i,
  ],
  [
    'creative',
    /\b(write|story|poem|essay|blog|article|creative|fiction|character|narrative|dialogue|screenplay|lyric|song|paint|draw|illustrat|design|generat.*image|concept\s?art|style\s?transfer|midjourney|dall[-\s]?e|stable\s?diffusion)/i,
  ],
  [
    'ops',
    /\b(deploy|infra|infrastructure|server|monitor|alert|incident|uptime|downtime|backup|restore|migration|pipeline|ci[\s/]?cd|terraform|ansible|helm|scaling|load\s?balancer|dns|ssl|cert|rotate)/i,
  ],
  [
    'personal',
    /\b(remind|schedul|calendar|todo|diary|journal|feel|felt|wife|husband|partner|kid|son|daughter|mom|dad|weekend|weeknight|vacation)/i,
  ],
];

export const STAKES_RULES: ReadonlyArray<[Stakes, RegExp]> = [
  [
    'critical',
    /\b(delete|drop|rm\s+-rf|wipe|destroy|production|prod\b|live|immediate|emergency|urgent|critical|CRITICAL|outage|hostile|breach|leak|exfiltrat)/i,
  ],
  [
    'high',
    /\b(clinical|patient|phi|hipaa|legal|compliance|deploy|migration|rotate|credential|token|password|key|audit)/i,
  ],
  ['medium', /\b(review|verify|check|test|stage|staging|rollout|config|schema|contract)/i],
  // Python regex is ^(thanks|...|great)[!\.\s]*$ with re.I. Without MULTILINE,
  // Python `^` and `$` match string start/end just like JS defaults.
  ['trivial', /^(thanks|thank you|ok|hi|hello|hey|cool|nice|good|great)[!\.\s]*$/i],
];

export function classifyType(text: string): TurnType {
  for (const [t, pat] of TYPE_RULES) {
    if (pat.test(text)) return t;
  }
  return 'general';
}

export function classifyStakes(text: string): Stakes {
  for (const [s, pat] of STAKES_RULES) {
    if (pat.test(text)) return s;
  }
  return 'low';
}

export function applyRouter(env: TurnEnvelope): TurnEnvelope {
  env.turn_type = classifyType(env.user_text);
  env.stakes = classifyStakes(env.user_text);
  return env;
}
