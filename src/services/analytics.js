// Small helpers shared by the student and faculty dashboards.
import { VIOLATIONS } from '../engine/safetyRules.js';

const avg = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

/** Average of each score component (prediction, procedure, safety, accuracy) over attempt objects. */
export function componentAverages(attempts) {
  const sums = {};
  for (const a of attempts) {
    for (const [k, v] of Object.entries(a.components || {})) (sums[k] ||= []).push(v);
  }
  return Object.fromEntries(Object.entries(sums).map(([k, v]) => [k, avg(v)]));
}

/** Mistake totals with how many different students made each one. `rows` = [{ roll, attempt }]. */
export function mistakeStats(rows) {
  const by = {};
  for (const { roll, attempt } of rows) {
    for (const m of attempt.mistakes || []) {
      const s = (by[m.id] ||= { id: m.id, count: 0, students: new Set(), ...VIOLATIONS[m.id] });
      s.count += m.count;
      s.students.add(roll);
    }
  }
  const order = { critical: 0, major: 1, minor: 2, info: 3 };
  return Object.values(by)
    .map((s) => ({ ...s, students: s.students.size }))
    .sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9) || b.count - a.count);
}

const cell = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCsv = (rows) => rows.map((r) => r.map(cell).join(',')).join('\n');

export function downloadText(text, filename, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
