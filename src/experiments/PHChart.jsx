// A small SVG pH chart. No chart library needed, so it works offline and keeps the bundle light.

const W = 520;
const H = 300;
const M = { top: 14, right: 18, bottom: 44, left: 40 };
const PW = W - M.left - M.right;
const PH = H - M.top - M.bottom;

/**
 * points:    the student's readings [{ volume, pH }] (blue line)
 * curve:     optional full theoretical curve (grey dashed), used on the result page
 * eq:        optional { volume, pH } to mark the equivalence point
 * current:   optional { volume, pH } to highlight the latest reading
 */
export default function PHChart({ points = [], curve, eq, current, maxVolume = 50, xLabel, eqLabel }) {
  const x = (v) => M.left + (v / maxVolume) * PW;
  const y = (ph) => M.top + PH - (Math.min(14, Math.max(0, ph)) / 14) * PH;
  const path = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.volume).toFixed(1)} ${y(p.pH).toFixed(1)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="ph-chart" role="img" aria-label="pH versus volume of NaOH">
      {[0, 2, 4, 6, 8, 10, 12, 14].map((ph) => (
        <g key={ph}>
          <line x1={M.left} x2={M.left + PW} y1={y(ph)} y2={y(ph)} className="grid" />
          <text x={M.left - 8} y={y(ph) + 4} textAnchor="end" className="tick">
            {ph}
          </text>
        </g>
      ))}
      {Array.from({ length: Math.floor(maxVolume / 10) + 1 }, (_, i) => i * 10).map((v) => (
        <text key={v} x={x(v)} y={M.top + PH + 16} textAnchor="middle" className="tick">
          {v}
        </text>
      ))}
      <text x={M.left + PW / 2} y={H - 8} textAnchor="middle" className="axis-label">
        {xLabel}
      </text>
      <text x={12} y={M.top + PH / 2} textAnchor="middle" className="axis-label" transform={`rotate(-90 12 ${M.top + PH / 2})`}>
        pH
      </text>
      <rect x={M.left} y={M.top} width={PW} height={PH} className="frame" />

      {curve && <path d={path(curve)} className="curve-ideal" />}
      {points.length > 1 && <path d={path(points)} className="curve-student" />}
      {points.length === 1 && <circle cx={x(points[0].volume)} cy={y(points[0].pH)} r="3.5" className="dot" />}
      {eq && (
        <g>
          <line x1={x(eq.volume)} x2={x(eq.volume)} y1={M.top} y2={M.top + PH} className="eq-line" />
          <circle cx={x(eq.volume)} cy={y(eq.pH)} r="5" className="eq-dot" />
          <text x={Math.min(x(eq.volume) + 8, W - 90)} y={y(eq.pH) + 18} className="eq-label">
            {eqLabel}
          </text>
        </g>
      )}
      {current && <circle cx={x(current.volume)} cy={y(current.pH)} r="5" className="now-dot" />}
    </svg>
  );
}
