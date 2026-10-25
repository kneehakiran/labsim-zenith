// Scoring: prediction, procedure, safety, and endpoint accuracy (plus concentration in mystery mode).

import { VIOLATIONS } from './safetyRules.js';
import { concentrationFromEndpoint, equivalencePH, equivalenceVolume, round } from './chemistry.js';

const PENALTY = { critical: 30, major: 15, minor: 4, info: 0 };
const MAX_EVENTS_PER_RULE = 3; // repeated minor slips stop costing points after 3

const WEIGHTS = { prediction: 0.2, procedure: 0.25, safety: 0.25, accuracy: 0.3 };

const clamp = (x, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, x));

function categoryScore(log, category) {
  const counts = {};
  for (const entry of log) {
    for (const id of entry.violations) {
      if (VIOLATIONS[id]?.category === category) counts[id] = (counts[id] || 0) + 1;
    }
  }
  let penalty = 0;
  for (const [id, n] of Object.entries(counts)) {
    penalty += PENALTY[VIOLATIONS[id].severity] * Math.min(n, MAX_EVENTS_PER_RULE);
  }
  return clamp(100 - penalty);
}

export const safetyScore = (log) => categoryScore(log, 'safety');
export const procedureScore = (log) => categoryScore(log, 'procedure');

/** Predicted pH at equivalence: full marks within 0.3 pH units, zero at 3 units off. */
export function predictionScore(predictedPH, actualPH) {
  const err = Math.abs(predictedPH - actualPH);
  return clamp(err <= 0.3 ? 100 : 100 * (1 - (err - 0.3) / 2.7));
}

/** Endpoint accuracy: full marks within 0.1 mL of equivalence, zero at 3 mL off. */
export function accuracyScore(endpointVolume, eqVolume) {
  const err = Math.abs(endpointVolume - eqVolume);
  return clamp(err <= 0.1 ? 100 : 100 * (1 - (err - 0.1) / 2.9));
}

/** Reported concentration: full marks within 2 percent, zero at 20 percent error. */
export function concentrationScore(reported, actual) {
  const rel = (Math.abs(reported - actual) / actual) * 100;
  return clamp(rel <= 2 ? 100 : 100 * (1 - (rel - 2) / 18));
}

export function gradeFor(total) {
  if (total >= 90) return 'A';
  if (total >= 75) return 'B';
  if (total >= 60) return 'C';
  if (total >= 40) return 'D';
  return 'E';
}

/**
 * Score a finished (or in-progress) session.
 * `prediction` (pH) and `reportedConcentration` (mol/L) are optional; missing parts are left out
 * and the weights of the remaining parts are renormalised.
 */
export function scoreSession({ state, config, prediction = null, reportedConcentration = null }) {
  const eqV = equivalenceVolume(config);
  const eqPH = equivalencePH(config);
  const endpoint = state.endpointVolume ?? state.volumeAdded;

  const components = {
    procedure: procedureScore(state.log),
    safety: safetyScore(state.log),
    accuracy: accuracyScore(endpoint, eqV),
  };
  if (prediction != null && !Number.isNaN(prediction)) {
    components.prediction = predictionScore(prediction, eqPH);
  }
  if (reportedConcentration != null && !Number.isNaN(reportedConcentration)) {
    components.concentration = concentrationScore(reportedConcentration, config.analyte.conc);
    // concentration is part of "accuracy" for mystery samples
    components.accuracy = (components.accuracy + components.concentration) / 2;
    delete components.concentration;
  }

  let weighted = 0;
  let weightSum = 0;
  for (const [key, value] of Object.entries(components)) {
    weighted += WEIGHTS[key] * value;
    weightSum += WEIGHTS[key];
  }
  const total = round(weighted / weightSum, 1);

  return {
    components: Object.fromEntries(Object.entries(components).map(([k, v]) => [k, round(v, 1)])),
    total,
    grade: gradeFor(total),
    truth: {
      equivalenceVolume: round(eqV, 2),
      equivalencePH: round(eqPH, 2),
      endpointVolume: round(endpoint, 2),
      trueConcentration: config.analyte.conc,
      studentConcentration: round(concentrationFromEndpoint(config, endpoint), 4),
    },
  };
}
