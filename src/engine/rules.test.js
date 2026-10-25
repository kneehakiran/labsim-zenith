import test from 'node:test';
import assert from 'node:assert/strict';
import { ACIDS, makeConfig, equivalenceVolume, generateMysterySample } from './chemistry.js';
import { createSession, applyAction } from './safetyRules.js';
import { scoreSession, predictionScore, accuracyScore, concentrationScore } from './scoring.js';
import { buildReplay, summarizeMistakes, volumeAtStep } from './mistakeReplay.js';

const config = makeConfig({ acid: ACIDS.hcl, conc: 0.1, volume: 25, titrantConc: 0.1 });
const weakConfig = makeConfig({ acid: ACIDS.acetic, conc: 0.1, volume: 25, titrantConc: 0.1 });

function run(cfg, actions, start) {
  let state = start ?? createSession(cfg);
  const results = [];
  for (const a of actions) {
    const r = applyAction(state, a, cfg);
    state = r.state;
    results.push(r);
  }
  return { state, results };
}

const GOOD_SETUP = [
  { type: 'wear_goggles' },
  { type: 'rinse_burette' },
  { type: 'fill_burette' },
  { type: 'remove_funnel' },
  { type: 'add_indicator', name: 'phenolphthalein' },
];

/** Correct technique: big steps while far away, then drop by drop, swirling every time. */
function carefulTitration(cfg) {
  const eq = equivalenceVolume(cfg);
  const acts = [];
  let v = 0;
  while (v + 5 < eq - 2) {
    acts.push({ type: 'add_titrant', volume: 5 }, { type: 'swirl' });
    v += 5;
  }
  while (v < eq - 1e-6) {
    const step = Math.min(0.1, eq - v);
    acts.push({ type: 'add_titrant', volume: step }, { type: 'swirl' });
    v = Math.round((v + step) * 1000) / 1000;
  }
  acts.push({ type: 'finish' });
  return acts;
}

test('a careful, correct session has no violations and a top score', () => {
  const { state } = run(config, [...GOOD_SETUP, ...carefulTitration(config)]);
  assert.deepEqual(state.log.flatMap((e) => e.violations), []);
  const score = scoreSession({ state, config, prediction: 7.0 });
  assert.equal(score.components.safety, 100);
  assert.equal(score.components.procedure, 100);
  assert.ok(score.total >= 95, `total ${score.total}`);
  assert.equal(score.grade, 'A');
});

test('titrating without goggles is a critical safety violation, reported once', () => {
  const { state, results } = run(config, [
    { type: 'rinse_burette' },
    { type: 'fill_burette' },
    { type: 'remove_funnel' },
  ]);
  const flagged = results.flatMap((r) => r.violations);
  assert.deepEqual(flagged.filter((v) => v === 'no_goggles'), ['no_goggles']);
  assert.ok(scoreSession({ state, config }).components.safety <= 70);
});

test('funnel left on the burette, no indicator, unrinsed burette are caught', () => {
  const { results } = run(config, [
    { type: 'wear_goggles' },
    { type: 'fill_burette' }, // not rinsed
    { type: 'add_titrant', volume: 1 }, // funnel on, no indicator
  ]);
  assert.deepEqual(results[1].violations, ['unrinsed_burette']);
  assert.deepEqual(results[2].violations.sort(), ['funnel_left', 'no_indicator']);
});

test('titrating from an empty burette is blocked without penalty', () => {
  const { state, results } = run(config, [{ type: 'wear_goggles' }, { type: 'add_titrant', volume: 1 }]);
  assert.equal(results[1].rejected, true);
  assert.deepEqual(results[1].violations, ['empty_burette']);
  assert.equal(state.volumeAdded, 0);
  assert.equal(scoreSession({ state, config }).components.procedure, 100);
});

test('forgetting to swirl is a minor, repeatable violation with a capped penalty', () => {
  const acts = [...GOOD_SETUP];
  for (let i = 0; i < 6; i++) acts.push({ type: 'add_titrant', volume: 1 });
  const { state } = run(config, acts);
  const noSwirl = state.log.flatMap((e) => e.violations).filter((v) => v === 'no_swirl');
  assert.equal(noSwirl.length, 5);
  assert.equal(scoreSession({ state, config }).components.procedure, 88); // 3 events x 4 pts, capped
});

test('adding big volumes near the endpoint, then overshooting, is flagged', () => {
  const { results } = run(config, [
    ...GOOD_SETUP,
    { type: 'add_titrant', volume: 22 },
    { type: 'swirl' },
    { type: 'add_titrant', volume: 5 }, // 22 mL -> 27 mL: within 2 mL window and overshoot
  ]);
  const last = results[results.length - 1].violations;
  assert.ok(last.includes('too_fast_near_endpoint'));
  assert.ok(last.includes('overshoot'));
});

test('methyl orange for a weak acid titration is a wrong-indicator mistake', () => {
  const { results } = run(weakConfig, [{ type: 'wear_goggles' }, { type: 'add_indicator', name: 'methylOrange' }]);
  assert.deepEqual(results[1].violations, ['wrong_indicator']);
});

test('burette cannot be emptied past 50 mL', () => {
  const { results } = run(config, [...GOOD_SETUP, { type: 'add_titrant', volume: 49 }, { type: 'add_titrant', volume: 5 }]);
  assert.equal(results[results.length - 1].rejected, true);
  assert.equal(results[results.length - 1].reason, 'burette_limit');
});

test('trap mode starts with faults that the student must fix before titrating', () => {
  const trap = { ...config, mode: 'trap' };
  const start = createSession(trap);
  assert.equal(start.goggles, false);
  assert.equal(start.funnelOnBurette, true);
  assert.equal(start.contaminated, true);

  // Ignoring the traps:
  const careless = run(trap, [{ type: 'add_indicator', name: 'phenolphthalein' }, { type: 'add_titrant', volume: 1 }], start);
  const ids = careless.state.log.flatMap((e) => e.violations);
  for (const id of ['no_goggles', 'funnel_left', 'unrinsed_burette']) assert.ok(ids.includes(id), id);

  // Spotting them all:
  const fixed = run(
    trap,
    [
      { type: 'wear_goggles' },
      { type: 'rinse_burette' },
      { type: 'fill_burette' },
      { type: 'remove_funnel' },
      { type: 'add_indicator', name: 'phenolphthalein' },
      { type: 'add_titrant', volume: 1 },
    ],
    createSession(trap),
  );
  assert.deepEqual(fixed.state.log.flatMap((e) => e.violations), []);
});

test('score components behave at their boundaries', () => {
  assert.equal(predictionScore(7.0, 7.2), 100);
  assert.equal(predictionScore(4, 7), 0);
  assert.equal(accuracyScore(25.05, 25), 100);
  assert.equal(accuracyScore(28.1, 25), 0);
  assert.equal(concentrationScore(0.101, 0.1), 100);
  assert.equal(concentrationScore(0.13, 0.1), 0);
});

test('mystery mode: concentration error lowers accuracy', () => {
  const cfg = generateMysterySample(7);
  const eq = equivalenceVolume(cfg);
  const { state } = run(cfg, [...GOOD_SETUP, { type: 'finish' }]);
  const forced = { ...state, endpointVolume: eq };
  const good = scoreSession({ state: forced, config: cfg, reportedConcentration: cfg.analyte.conc });
  const bad = scoreSession({ state: forced, config: cfg, reportedConcentration: cfg.analyte.conc * 1.3 });
  assert.ok(good.components.accuracy > bad.components.accuracy);
});

test('mistake replay explains each mistake and tracks volume', () => {
  const { state } = run(config, [
    { type: 'fill_burette' },
    { type: 'add_titrant', volume: 3 },
    { type: 'swirl' },
    { type: 'add_titrant', volume: 3 },
  ]);
  const replay = buildReplay(state.log, config);
  assert.ok(replay.length >= 2);
  assert.ok(replay.every((s) => s.mistakes.every((m) => m.whyKey.startsWith('mistake.') && m.fixKey.endsWith('.fix'))));
  const summary = summarizeMistakes(state.log);
  assert.equal(summary[0].id, 'no_goggles'); // critical first
  assert.equal(volumeAtStep(state.log, 1), 3);
  assert.equal(volumeAtStep(state.log, 3), 6);
});
