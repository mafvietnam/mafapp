/**
 * Defensive output validation for the AI narrative — "AI never emits a number absent
 * from the input" (phase-04 success criteria). Any digit sequence in the returned text
 * must match a number that was actually present in the structured input (duration
 * fields, HR zone bounds, or a chapter number from the allowed citations) — anything
 * else (an invented HR, a hallucinated duration) fails validation and the caller falls
 * back to the template narrative. Also rejects empty/oversized output as a cheap sanity
 * bound (the system prompt caps ~120 words; ~120 words of Vietnamese is well under 1500
 * chars).
 */

import type { StructuredCoachingInput } from './coaching-prompt.js';

const MAX_NARRATIVE_CHARS = 1500;

function allowedNumbers(input: StructuredCoachingInput): Set<number> {
  const nums = new Set<number>([
    input.totalMinutes,
    input.warmupMin,
    input.mainMinutes,
    input.cooldownMin,
  ]);
  if (input.hrZone) {
    nums.add(input.hrZone.lower);
    nums.add(input.hrZone.upper);
  }
  for (const c of input.citations) {
    const n = parseInt(c.replace(/^CH/, ''), 10);
    if (!Number.isNaN(n)) nums.add(n);
  }
  return nums;
}

/** True when `narrative` is safe to serve as-is (non-empty, bounded, no invented numbers). */
export function isNarrativeSafe(
  narrative: string,
  input: StructuredCoachingInput,
): boolean {
  const trimmed = narrative.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_NARRATIVE_CHARS)
    return false;

  const allowed = allowedNumbers(input);
  const matches = trimmed.match(/\d+/g) ?? [];
  for (const m of matches) {
    const n = parseInt(m, 10);
    if (!allowed.has(n)) return false;
  }
  return true;
}
