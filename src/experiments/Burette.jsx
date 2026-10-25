import { BURETTE_CAPACITY_ML } from '../engine/chemistry.js';

const TOP = 40; // y of the 0 mL mark
const BOTTOM = 250; // y of the 50 mL mark
const SCALE = (BOTTOM - TOP) / BURETTE_CAPACITY_ML;

/** Burette with graduations; the liquid level falls as titrant is added. */
export default function Burette({ filled, volumeAdded, funnelOn, dripping, label }) {
  const level = TOP + volumeAdded * SCALE;
  const marks = [];
  for (let v = 0; v <= BURETTE_CAPACITY_ML; v += 5) {
    const y = TOP + v * SCALE;
    marks.push(
      <g key={v}>
        <line x1="42" x2={v % 10 === 0 ? 56 : 52} y1={y} y2={y} stroke="currentColor" strokeWidth="1" />
        {v % 10 === 0 && (
          <text x="36" y={y + 3.5} fontSize="10" textAnchor="end" fill="currentColor">
            {v}
          </text>
        )}
      </g>,
    );
  }

  return (
    <svg viewBox="0 0 130 330" role="img" aria-label={label} className="apparatus burette">
      {funnelOn && (
        <g data-testid="funnel">
          <path d="M30 6 H90 L68 36 H52 Z" fill="#7aa7c9" opacity="0.85" stroke="#99ceff" />
        </g>
      )}
      {/* tube */}
      <rect x="52" y={TOP - 4} width="16" height={BOTTOM - TOP + 8} rx="3" fill="rgba(153,206,255,0.08)" stroke="#99ceff" />
      {/* titrant */}
      {filled && <rect x="53" y={level} width="14" height={BOTTOM + 4 - level} fill="rgba(240,248,255,0.85)" />}
      {filled && <line x1="53" x2="67" y1={level} y2={level} stroke="#fff" strokeWidth="1.5" />}
      {marks}
      {/* stopcock and tip */}
      <rect x="44" y={BOTTOM + 6} width="32" height="9" rx="3" fill="#2d6aa3" />
      <path d="M56 262 H64 L61 288 H59 Z" fill="rgba(153,206,255,0.15)" stroke="#99ceff" />
      {dripping && (
        <circle className="drop" cx="60" cy="292" r="3.2" fill="rgba(240,248,255,0.95)" />
      )}
    </svg>
  );
}
