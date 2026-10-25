import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n.jsx';
import {
  INDICATORS,
  equivalenceVolume,
  indicatorColor,
  round,
  solutionPH,
} from '../engine/chemistry.js';
import { VIOLATIONS, applyAction, createSession } from '../engine/safetyRules.js';
import Burette from './Burette.jsx';
import Flask from './Flask.jsx';
import PHChart from './PHChart.jsx';

const ADD_STEPS = [0.05, 0.5, 1, 5, 10];

/** The next thing a good student would do. Used for hints in guided mode only. */
function nextHintKey(s, config) {
  if (!s.goggles) return 'hint.goggles';
  if (!s.rinsed) return 'hint.rinse';
  if (!s.buretteFilled) return 'hint.fill';
  if (s.funnelOnBurette) return 'hint.removeFunnel';
  if (!s.indicator) return 'hint.indicator';
  if (s.volumeAdded > 0 && !s.swirled) return 'hint.swirl';
  const ind = INDICATORS[s.indicator];
  const pH = solutionPH(config, s.volumeAdded);
  const colourFraction = (pH - ind.pHLow) / (ind.pHHigh - ind.pHLow);
  const remaining = equivalenceVolume(config) - s.volumeAdded;
  if (colourFraction >= 0.5 && remaining <= 1.5) return 'hint.finish';
  if (remaining <= 3) return 'hint.dropwise';
  return 'hint.titrate';
}

export default function Titration({ config, onFinish, onExit }) {
  const { t } = useI18n();
  const mode = config.mode;

  const [phase, setPhase] = useState('predict'); // predict | bench | report
  const [predInput, setPredInput] = useState('');
  const [prediction, setPrediction] = useState(null);
  const [session, setSession] = useState(() => createSession(config));
  const [trail, setTrail] = useState(() => [{ volume: 0, pH: solutionPH(config, 0) }]);
  const [messages, setMessages] = useState([]);
  const [indicatorChoice, setIndicatorChoice] = useState('');
  const [concInput, setConcInput] = useState('');
  const [dripping, setDripping] = useState(false);
  const [swirling, setSwirling] = useState(false);
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const pulse = (setter, ms) => {
    setter(true);
    timers.current.push(setTimeout(() => setter(false), ms));
  };

  const pH = solutionPH(config, session.volumeAdded);
  const color = session.indicator ? indicatorColor(session.indicator, pH) : indicatorColor(null, pH);
  const locked = session.finished;
  const hintKey = mode === 'guided' && !locked ? nextHintKey(session, config) : null;

  const act = (action) => {
    const r = applyAction(session, action, config);
    setSession(r.state);

    const fresh = [];
    if (r.rejected && r.reason) fresh.push({ key: `rej-${Date.now()}`, kind: 'reason', id: r.reason });
    if (mode !== 'trap' && !r.rejected) {
      for (const id of r.violations) fresh.push({ key: `${id}-${Date.now()}`, kind: 'mistake', id });
    }
    if (fresh.length) setMessages((prev) => [...fresh, ...prev].slice(0, 5));

    if (action.type === 'add_titrant' && !r.rejected) {
      setTrail((prev) => [...prev, { volume: r.state.volumeAdded, pH: solutionPH(config, r.state.volumeAdded) }]);
      pulse(setDripping, 700);
    }
    if (action.type === 'swirl') pulse(setSwirling, 900);
    return r;
  };

  const finish = () => {
    const r = act({ type: 'finish' });
    if (mode === 'mystery') setPhase('report');
    else onFinish({ state: r.state, config, prediction, reportedConcentration: null, trail });
  };

  const submitConcentration = (e) => {
    e.preventDefault();
    const value = parseFloat(concInput);
    if (!(value > 0)) return;
    onFinish({ state: session, config, prediction, reportedConcentration: value, trail });
  };

  const lockPrediction = (e) => {
    e.preventDefault();
    const value = parseFloat(predInput);
    if (Number.isNaN(value) || value < 0 || value > 14) return;
    setPrediction(round(value, 2));
    setPhase('bench');
  };

  const analyteText = useMemo(
    () =>
      mode === 'mystery'
        ? t('lab.analyteUnknown', { vol: config.analyte.volume })
        : t('lab.analyte', { vol: config.analyte.volume, acid: config.analyte.name, conc: config.analyte.conc }),
    [mode, config, t],
  );

  const banner = mode === 'trap' ? t('lab.trapBanner') : mode === 'mystery' ? t('lab.mysteryBanner') : null;

  return (
    <div className="lab">
      <div className="lab-head">
        <button type="button" className="btn ghost" onClick={onExit}>
          {t('lab.exit')}
        </button>
        <div className="lab-setup">
          <strong>{analyteText}</strong>
          <span>{t('lab.titrant', { conc: config.titrant.conc })}</span>
        </div>
        <span className={`chip ${session.goggles ? 'ok' : 'warn'}`}>{session.goggles ? t('lab.gogglesOn') : t('lab.gogglesOff')}</span>
      </div>

      {banner && <p className="banner">{banner}</p>}

      {phase === 'predict' && (
        <form className="panel predict" onSubmit={lockPrediction}>
          <h2>{t('lab.predictTitle')}</h2>
          <p>{t('lab.predictPrompt')}</p>
          {mode === 'mystery' && <p className="muted">{t('lab.predictMystery')}</p>}
          <div className="row">
            <input
              type="number"
              inputMode="decimal"
              min="0"
              max="14"
              step="0.1"
              value={predInput}
              onChange={(e) => setPredInput(e.target.value)}
              aria-label={t('lab.predictTitle')}
              placeholder="pH"
              required
            />
            <button type="submit" className="btn primary">
              {t('lab.predictBtn')}
            </button>
            <button type="button" className="btn ghost" onClick={() => setPhase('bench')}>
              {t('lab.skipPredict')}
            </button>
          </div>
        </form>
      )}

      {phase !== 'predict' && (
        <div className="lab-grid">
          <section className="panel bench" aria-label={t('lab.burette')}>
            <div className="apparatus-row">
              <figure>
                <Burette
                  filled={session.buretteFilled}
                  volumeAdded={session.volumeAdded}
                  funnelOn={session.funnelOnBurette}
                  dripping={dripping}
                  label={t('lab.burette')}
                />
                <figcaption>{t('lab.burette')}</figcaption>
              </figure>
              <figure>
                <Flask
                  color={color}
                  analyteVolume={config.analyte.volume}
                  volumeAdded={session.volumeAdded}
                  swirling={swirling}
                  label={t('lab.flask')}
                />
                <figcaption>{t('lab.flask')}</figcaption>
              </figure>
            </div>
            <dl className="meters">
              <div>
                <dt>{t('lab.added')}</dt>
                <dd data-testid="volume">{session.volumeAdded.toFixed(2)} mL</dd>
              </div>
              <div>
                <dt>{t('lab.ph')}</dt>
                <dd data-testid="ph">{pH.toFixed(2)}</dd>
              </div>
            </dl>
          </section>

          <section className="panel controls">
            <h3>{t('lab.steps')}</h3>
            <div className="btn-grid">
              <button type="button" className="btn" disabled={locked} onClick={() => act({ type: 'wear_goggles' })}>
                {t('act.goggles')}
              </button>
              <button type="button" className="btn" disabled={locked} onClick={() => act({ type: 'rinse_burette' })}>
                {t('act.rinse')}
              </button>
              <button type="button" className="btn" disabled={locked} onClick={() => act({ type: 'fill_burette' })}>
                {t('act.fill')}
              </button>
              <button type="button" className="btn" disabled={locked} onClick={() => act({ type: 'remove_funnel' })}>
                {t('act.removeFunnel')}
              </button>
            </div>

            <div className="row">
              <select
                value={indicatorChoice}
                onChange={(e) => setIndicatorChoice(e.target.value)}
                aria-label={t('lab.indicatorChoose')}
                disabled={locked}
              >
                <option value="">{t('lab.indicatorChoose')}</option>
                {Object.keys(INDICATORS).map((id) => (
                  <option key={id} value={id}>
                    {t(`ind.${id}`)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn"
                disabled={locked || !indicatorChoice}
                onClick={() => act({ type: 'add_indicator', name: indicatorChoice })}
              >
                {t('act.indicator')}
              </button>
            </div>

            <h3>{t('act.add')}</h3>
            <div className="btn-grid add">
              {ADD_STEPS.map((v) => (
                <button
                  key={v}
                  type="button"
                  className="btn accent"
                  disabled={locked}
                  onClick={() => act({ type: 'add_titrant', volume: v })}
                >
                  {v === 0.05 ? t('act.drop') : `+${v} mL`}
                </button>
              ))}
            </div>

            <div className="row">
              <button type="button" className="btn" disabled={locked} onClick={() => act({ type: 'swirl' })}>
                {t('act.swirl')}
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={locked || session.volumeAdded === 0}
                onClick={finish}
              >
                {t('act.finish')}
              </button>
            </div>
          </section>

          {(hintKey || messages.length > 0) && (
            <section className="panel feedback" aria-live="polite">
              <h3>{t('lab.feedback')}</h3>
              {hintKey && (
                <p className="hint">
                  <strong>{t('lab.hintLabel')}:</strong> {t(hintKey)}
                </p>
              )}
              <ul>
                {messages.map((m) =>
                  m.kind === 'reason' ? (
                    <li key={m.key} className="msg info">
                      {t(`reason.${m.id}`)}
                    </li>
                  ) : (
                    <li key={m.key} className={`msg ${VIOLATIONS[m.id].severity}`}>
                      <span className="badge">{t(`sev.${VIOLATIONS[m.id].severity}`)}</span> <strong>{t(`mistake.${m.id}.name`)}</strong>
                      {mode === 'guided' && <span className="why"> {t(`mistake.${m.id}.why`)}</span>}
                      <span className="fix"> {t(`mistake.${m.id}.fix`)}</span>
                    </li>
                  ),
                )}
              </ul>
            </section>
          )}

          <section className="panel graph">
            <h3>{t('lab.curve')}</h3>
            <PHChart
              points={trail}
              current={trail[trail.length - 1]}
              xLabel={t('lab.volumeAxis')}
            />
          </section>
        </div>
      )}

      {phase === 'report' && (
        <div className="modal-backdrop">
          <form className="panel modal" onSubmit={submitConcentration}>
            <h2>{t('lab.enterConc')}</h2>
            <p className="muted">{t('lab.concHelp')}</p>
            <p>
              <strong>{t('lab.added')}: {session.endpointVolume?.toFixed(2)} mL</strong>
            </p>
            <div className="row">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.001"
                value={concInput}
                onChange={(e) => setConcInput(e.target.value)}
                aria-label={t('lab.enterConc')}
                required
                autoFocus
              />
              <button type="submit" className="btn primary">
                {t('lab.submit')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
