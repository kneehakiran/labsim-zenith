// LabSim chemistry engine: acid-base titration (monoprotic acid titrated with strong base).
//
// The pH is computed from the exact charge balance
//     [H+] + [Na+] = [OH-] + [A-]
// where [A-] = Ca * Ka / (Ka + [H+]) for a weak acid, or Ca for a strong acid.
// This is solved numerically, so it is correct before, at, and after the equivalence
// point without switching between approximate formulas.

export const KW = 1e-14;

/** Acids students can meet. Ka = null means a strong (fully dissociated) acid. */
export const ACIDS = {
  hcl: { id: 'hcl', name: 'HCl', Ka: null },
  formic: { id: 'formic', name: 'HCOOH', Ka: 1.8e-4 },
  acetic: { id: 'acetic', name: 'CH3COOH', Ka: 1.8e-5 },
};

/** Indicators: colour for pH <= pHLow is `acidColor`, for pH >= pHHigh is `baseColor`. */
export const INDICATORS = {
  methylOrange: {
    id: 'methylOrange',
    name: 'Methyl orange',
    pHLow: 3.1,
    pHHigh: 4.4,
    acidColor: [226, 60, 48],
    baseColor: [250, 205, 45],
  },
  bromothymolBlue: {
    id: 'bromothymolBlue',
    name: 'Bromothymol blue',
    pHLow: 6.0,
    pHHigh: 7.6,
    acidColor: [245, 210, 50],
    baseColor: [60, 110, 220],
  },
  phenolphthalein: {
    id: 'phenolphthalein',
    name: 'Phenolphthalein',
    pHLow: 8.2,
    pHHigh: 10.0,
    acidColor: [222, 236, 246], // near-colourless
    baseColor: [226, 60, 140],
  },
};

export const BURETTE_CAPACITY_ML = 50;

/**
 * Titration setup.
 * analyte: { name, conc (mol/L), volume (mL), Ka | null }
 * titrant: { name, conc (mol/L) }
 */
export function makeConfig({ acid = ACIDS.hcl, conc = 0.1, volume = 25, titrantConc = 0.1, mode = 'guided' } = {}) {
  return {
    mode,
    analyte: { name: acid.name, conc, volume, Ka: acid.Ka },
    titrant: { name: 'NaOH', conc: titrantConc },
  };
}

function solveH(Na, Ca, Ka) {
  // f is strictly increasing in [H+], so g(pH) = f(10^-pH) is strictly decreasing: bisect on pH.
  const g = (pH) => {
    const h = 10 ** -pH;
    const dissociated = Ka == null ? Ca : (Ca * Ka) / (Ka + h);
    return h + Na - KW / h - dissociated;
  };
  let lo = -1;
  let hi = 15;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (g(mid) > 0) lo = mid; // too acidic: true pH is higher
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** pH after adding `addedVolume` mL of titrant. */
export function solutionPH(config, addedVolume) {
  const { analyte, titrant } = config;
  const vb = Math.max(0, addedVolume);
  const total = analyte.volume + vb;
  const Ca = (analyte.conc * analyte.volume) / total;
  const Na = (titrant.conc * vb) / total;
  return solveH(Na, Ca, analyte.Ka);
}

/** Volume (mL) of titrant needed to reach the equivalence point. */
export function equivalenceVolume(config) {
  return (config.analyte.conc * config.analyte.volume) / config.titrant.conc;
}

export function equivalencePH(config) {
  return solutionPH(config, equivalenceVolume(config));
}

/** pH curve as [{ volume, pH }]; sampled finely near the equivalence point. */
export function titrationCurve(config, maxVolume = BURETTE_CAPACITY_ML) {
  const eq = equivalenceVolume(config);
  const volumes = new Set();
  for (let v = 0; v <= maxVolume + 1e-9; v += 0.5) volumes.add(round(v, 3));
  for (let v = Math.max(0, eq - 2); v <= Math.min(maxVolume, eq + 2) + 1e-9; v += 0.05) volumes.add(round(v, 3));
  volumes.add(round(eq, 3));
  return [...volumes]
    .filter((v) => v <= maxVolume)
    .sort((a, b) => a - b)
    .map((volume) => ({ volume, pH: solutionPH(config, volume) }));
}

/** Indicator colour as a CSS rgb() string at a given pH. */
export function indicatorColor(indicatorId, pH) {
  const ind = INDICATORS[indicatorId];
  if (!ind) return 'rgb(222, 236, 246)'; // clear solution
  const t = Math.min(1, Math.max(0, (pH - ind.pHLow) / (ind.pHHigh - ind.pHLow)));
  const c = ind.acidColor.map((a, i) => Math.round(a + (ind.baseColor[i] - a) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/**
 * An indicator suits a titration when its mid transition pH lies inside the steep
 * part of the curve (between pH at 0.1 mL before and 0.1 mL after equivalence).
 */
export function isIndicatorSuitable(config, indicatorId) {
  const ind = INDICATORS[indicatorId];
  if (!ind) return false;
  const eq = equivalenceVolume(config);
  const before = solutionPH(config, eq - 0.1);
  const after = solutionPH(config, eq + 0.1);
  const mid = (ind.pHLow + ind.pHHigh) / 2;
  return mid >= before && mid <= after;
}

/** Student's concentration from an endpoint reading (C1 V1 = C2 V2). */
export function concentrationFromEndpoint(config, endpointVolume) {
  return (config.titrant.conc * endpointVolume) / config.analyte.volume;
}

// Deterministic pseudo-random numbers so a "mystery sample" can be reproduced from a seed.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random unknown acid (strong or weak) at 0.05-0.17 M so the endpoint fits in a 50 mL burette. */
export function generateMysterySample(seed = Date.now()) {
  const rand = mulberry32(seed);
  const acidList = Object.values(ACIDS);
  const acid = acidList[Math.floor(rand() * acidList.length)];
  const conc = round(0.05 + rand() * 0.12, 3);
  return makeConfig({ acid, conc, mode: 'mystery' });
}

export function round(x, digits = 2) {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
}
