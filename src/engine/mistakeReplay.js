// Mistake Replay: turns the session log into a step-by-step review of what went wrong and why.

import { VIOLATIONS } from './safetyRules.js';
import { solutionPH, round } from './chemistry.js';

const SEVERITY_ORDER = { critical: 0, major: 1, minor: 2, info: 3 };

/**
 * One replay step per logged action that triggered at least one violation.
 * Text lives in the locale files: `mistake.<id>.why` and `mistake.<id>.fix`.
 */
export function buildReplay(log, config) {
  return log
    .filter((entry) => entry.violations.length > 0)
    .map((entry) => ({
      index: entry.i,
      action: entry.action,
      rejected: entry.rejected,
      volumeBefore: entry.volumeBefore,
      volumeAfter: entry.volumeAfter,
      pHAfter: round(solutionPH(config, entry.volumeAfter), 2),
      mistakes: entry.violations.map((id) => ({
        id,
        ...VIOLATIONS[id],
        whyKey: `mistake.${id}.why`,
        fixKey: `mistake.${id}.fix`,
      })),
    }));
}

/** Mistake totals, most serious first. */
export function summarizeMistakes(log) {
  const byId = new Map();
  for (const entry of log) {
    for (const id of entry.violations) {
      const found = byId.get(id) ?? { id, count: 0, firstIndex: entry.i, ...VIOLATIONS[id] };
      found.count += 1;
      byId.set(id, found);
    }
  }
  return [...byId.values()].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.firstIndex - b.firstIndex,
  );
}

/** Titrant volume on the bench just after action number `index` (for scrubbing through a replay). */
export function volumeAtStep(log, index) {
  let v = 0;
  for (const entry of log) {
    if (entry.i > index) break;
    v = entry.volumeAfter;
  }
  return v;
}
