import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACIDS,
  INDICATORS,
  makeConfig,
  solutionPH,
  equivalenceVolume,
  equivalencePH,
  titrationCurve,
  isIndicatorSuitable,
  concentrationFromEndpoint,
  generateMysterySample,
  indicatorColor,
} from './chemistry.js';

const near = (actual, expected, tol, label) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${label}: expected ${expected} +/- ${tol}, got ${actual}`);

// ---- strong acid / strong base: 25 mL of 0.1 M HCl vs 0.1 M NaOH ----
const strong = makeConfig({ acid: ACIDS.hcl, conc: 0.1, volume: 25, titrantConc: 0.1 });

test('strong acid: initial pH is 1.00', () => near(solutionPH(strong, 0), 1.0, 0.005, 'initial'));

test('strong acid: pH at 10 mL (hand calc 1.368)', () => {
  // [H+] = (2.5 - 1.0) mmol / 35 mL = 0.042857 M
  near(solutionPH(strong, 10), -Math.log10(1.5 / 35), 0.005, '10 mL');
});

test('strong acid: equivalence volume 25 mL, pH 7.00', () => {
  near(equivalenceVolume(strong), 25, 1e-9, 'Veq');
  near(equivalencePH(strong), 7.0, 0.01, 'pH eq');
});

test('strong acid: pH past equivalence at 50 mL (hand calc 12.523)', () => {
  // [OH-] = 2.5 mmol / 75 mL = 0.033333 M
  near(solutionPH(strong, 50), 14 + Math.log10(2.5 / 75), 0.005, '50 mL');
});

test('strong acid: sharp jump across the equivalence point', () => {
  assert.ok(solutionPH(strong, 25.1) - solutionPH(strong, 24.9) > 6);
});

// ---- weak acid / strong base: 25 mL of 0.1 M acetic acid vs 0.1 M NaOH ----
const weak = makeConfig({ acid: ACIDS.acetic, conc: 0.1, volume: 25, titrantConc: 0.1 });
const pKa = -Math.log10(1.8e-5);

test('weak acid: initial pH about 2.88', () => near(solutionPH(weak, 0), 2.88, 0.02, 'initial'));

test('weak acid: half-equivalence pH equals pKa (4.74)', () => {
  near(solutionPH(weak, 12.5), pKa, 0.02, 'half-eq');
});

test('weak acid: equivalence pH is basic, about 8.72', () => {
  near(equivalencePH(weak), 8.72, 0.02, 'pH eq');
});

test('weak acid: pH past equivalence matches excess OH- (50 mL, 12.52)', () => {
  near(solutionPH(weak, 50), 14 + Math.log10(2.5 / 75), 0.01, '50 mL');
});

// ---- general behaviour ----
test('pH never decreases as base is added', () => {
  for (const cfg of [strong, weak]) {
    const curve = titrationCurve(cfg);
    for (let i = 1; i < curve.length; i++) {
      assert.ok(curve[i].pH >= curve[i - 1].pH - 1e-9, `non-monotonic at ${curve[i].volume} mL`);
    }
  }
});

test('indicator suitability: phenolphthalein fits both; methyl orange fails for weak acid', () => {
  assert.equal(isIndicatorSuitable(strong, 'phenolphthalein'), true);
  assert.equal(isIndicatorSuitable(weak, 'phenolphthalein'), true);
  assert.equal(isIndicatorSuitable(weak, 'methylOrange'), false);
  assert.equal(isIndicatorSuitable(weak, 'bromothymolBlue'), false);
});

test('phenolphthalein is pink above pH 10 and pale below 8', () => {
  assert.equal(indicatorColor('phenolphthalein', 11), 'rgb(226, 60, 140)');
  assert.equal(indicatorColor('phenolphthalein', 5), 'rgb(222, 236, 246)');
  assert.ok(INDICATORS.phenolphthalein.pHLow < INDICATORS.phenolphthalein.pHHigh);
});

test('concentration from endpoint reading', () => {
  near(concentrationFromEndpoint(strong, 25), 0.1, 1e-9, 'conc');
  near(concentrationFromEndpoint(weak, 12.5), 0.05, 1e-9, 'conc');
});

test('mystery sample is reproducible and fits the burette', () => {
  const a = generateMysterySample(42);
  const b = generateMysterySample(42);
  assert.deepEqual(a, b);
  for (let seed = 1; seed <= 200; seed++) {
    const cfg = generateMysterySample(seed);
    const veq = equivalenceVolume(cfg);
    assert.ok(veq > 10 && veq < 45, `seed ${seed}: Veq ${veq}`);
    assert.equal(cfg.mode, 'mystery');
  }
});
