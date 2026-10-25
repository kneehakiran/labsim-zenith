import { useId } from 'react';
import { BURETTE_CAPACITY_ML } from '../engine/chemistry.js';

const BODY_PATH = 'M85 10 H115 V72 L172 190 Q178 207 160 207 H40 Q22 207 28 190 L85 72 Z';
const FLOOR = 207;
const HEIGHT = 140;

/** Conical flask. `color` is the CSS colour of the solution (from the indicator). */
export default function Flask({ color, analyteVolume, volumeAdded, swirling, label }) {
  const clipId = useId();
  const total = analyteVolume + volumeAdded;
  const fraction = 0.25 + 0.5 * (total / (analyteVolume + BURETTE_CAPACITY_ML));
  const top = FLOOR - fraction * HEIGHT;

  return (
    <svg viewBox="0 0 200 230" role="img" aria-label={label} className={`apparatus flask${swirling ? ' swirl' : ''}`}>
      <defs>
        <clipPath id={clipId}>
          <path d={BODY_PATH} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect x="0" y={top} width="200" height={FLOOR - top + 2} fill={color} style={{ transition: 'fill 0.4s' }} />
        <rect x="0" y={top} width="200" height="3" fill="rgba(255,255,255,0.45)" />
      </g>
      <path d={BODY_PATH} fill="rgba(153,206,255,0.07)" stroke="#99ceff" strokeWidth="2" />
      <line x1="80" x2="120" y1="10" y2="10" stroke="#99ceff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
