// Procedure and safety rules. The session state is immutable: applyAction() returns a new state.
//
// Actions:  wear_goggles | rinse_burette | fill_burette | remove_funnel
//           add_indicator {name} | swirl | add_titrant {volume} | finish

import {
  BURETTE_CAPACITY_ML,
  equivalenceVolume,
  isIndicatorSuitable,
  round,
} from './chemistry.js';

/** severity: critical | major | minor | info. info = blocked action, no penalty. */
export const VIOLATIONS = {
  no_goggles: { severity: 'critical', category: 'safety' },
  funnel_left: { severity: 'major', category: 'safety' },
  unrinsed_burette: { severity: 'major', category: 'procedure' },
  no_indicator: { severity: 'major', category: 'procedure' },
  wrong_indicator: { severity: 'major', category: 'procedure' },
  too_fast_near_endpoint: { severity: 'major', category: 'procedure' },
  overshoot: { severity: 'major', category: 'procedure' },
  no_swirl: { severity: 'minor', category: 'procedure' },
  empty_burette: { severity: 'info', category: 'procedure' },
};

/** Violations reported once per session (the rest are counted every time they happen). */
const ONCE = new Set([
  'no_goggles',
  'funnel_left',
  'unrinsed_burette',
  'no_indicator',
  'wrong_indicator',
  'overshoot',
]);

const NEAR_ENDPOINT_WINDOW_ML = 2; // within this distance of equivalence, go drop by drop
const MAX_STEP_NEAR_ENDPOINT_ML = 0.5;
const OVERSHOOT_MARGIN_ML = 1.0;

/**
 * Fresh bench. `trap` mode starts with hidden faults the student must spot and fix:
 * no goggles, a filled burette that was never rinsed, and the funnel still in the top.
 */
export function createSession(config) {
  const trap = config.mode === 'trap';
  return {
    goggles: false,
    buretteFilled: trap,
    rinsed: false,
    contaminated: trap,
    funnelOnBurette: trap,
    indicator: null,
    swirled: true,
    volumeAdded: 0,
    finished: false,
    endpointVolume: null,
    flagged: [], // ids already reported (for ONCE rules)
    log: [],
  };
}

function check(state, config, action, next) {
  const found = [];
  const report = (id) => {
    if (ONCE.has(id) && next.flagged.includes(id)) return;
    if (ONCE.has(id)) next.flagged = [...next.flagged, id];
    found.push(id);
  };

  // Goggles: required before touching any chemical.
  if (!state.goggles && action.type !== 'wear_goggles' && action.type !== 'finish') report('no_goggles');

  switch (action.type) {
    case 'fill_burette':
      if (next.contaminated) report('unrinsed_burette');
      break;
    case 'add_indicator':
      if (!isIndicatorSuitable(config, action.name)) report('wrong_indicator');
      break;
    case 'add_titrant': {
      if (state.funnelOnBurette) report('funnel_left');
      if (state.contaminated) report('unrinsed_burette');
      if (!state.indicator) report('no_indicator');
      if (!state.swirled && state.volumeAdded > 0) report('no_swirl');
      // A big pour that lands inside (or leaps over) the endpoint zone is too fast.
      const remainingAfter = equivalenceVolume(config) - next.volumeAdded;
      if (remainingAfter <= NEAR_ENDPOINT_WINDOW_ML && action.volume > MAX_STEP_NEAR_ENDPOINT_ML) {
        report('too_fast_near_endpoint');
      }
      if (next.volumeAdded > equivalenceVolume(config) + OVERSHOOT_MARGIN_ML) report('overshoot');
      break;
    }
    default:
  }
  return found;
}

/**
 * Apply one action. Returns { state, violations: [id], rejected: bool, reason }.
 * Rejected actions (e.g. titrating from an empty burette) change nothing except the log.
 */
export function applyAction(state, action, config) {
  const next = { ...state, flagged: [...state.flagged] };
  let rejected = false;
  let reason = null;
  let extra = [];

  switch (action.type) {
    case 'wear_goggles':
      next.goggles = true;
      break;
    case 'rinse_burette':
      next.rinsed = true;
      next.contaminated = false;
      next.buretteFilled = false; // rinse, drain, then fill again with titrant
      next.funnelOnBurette = false;
      break;
    case 'fill_burette':
      next.buretteFilled = true;
      next.funnelOnBurette = true; // filled through a funnel that must be removed
      next.contaminated = !state.rinsed; // filling a burette that was never rinsed with titrant
      break;
    case 'remove_funnel':
      next.funnelOnBurette = false;
      break;
    case 'add_indicator':
      next.indicator = action.name;
      break;
    case 'swirl':
      next.swirled = true;
      break;
    case 'add_titrant': {
      const vol = Number(action.volume);
      if (!state.buretteFilled) {
        rejected = true;
        reason = 'empty_burette';
        extra = ['empty_burette'];
      } else if (!(vol > 0)) {
        rejected = true;
        reason = 'invalid_volume';
      } else if (state.volumeAdded + vol > BURETTE_CAPACITY_ML + 1e-9) {
        rejected = true;
        reason = 'burette_limit';
      } else if (state.finished) {
        rejected = true;
        reason = 'already_finished';
      } else {
        next.volumeAdded = round(state.volumeAdded + vol, 3);
        next.swirled = false;
      }
      break;
    }
    case 'finish':
      next.finished = true;
      next.endpointVolume = state.volumeAdded;
      break;
    default:
      rejected = true;
      reason = 'unknown_action';
  }

  const violations = rejected ? extra : check(state, config, action, next);
  next.log = [
    ...state.log,
    {
      i: state.log.length,
      action: { ...action },
      rejected,
      violations,
      volumeBefore: state.volumeAdded,
      volumeAfter: next.volumeAdded,
    },
  ];
  return { state: next, violations, rejected, reason };
}

/** Ideal order of steps, as locale keys. */
export const CORRECT_PROCEDURE = [
  'step.goggles',
  'step.rinse',
  'step.fill',
  'step.removeFunnel',
  'step.indicator',
  'step.titrate',
  'step.swirl',
  'step.dropwise',
  'step.record',
];
