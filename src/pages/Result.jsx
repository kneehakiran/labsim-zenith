import { useMemo, useState } from 'react';
import { useI18n } from '../i18n.jsx';
import { equivalenceVolume, equivalencePH, titrationCurve } from '../engine/chemistry.js';
import { CORRECT_PROCEDURE, VIOLATIONS } from '../engine/safetyRules.js';
import { buildReplay } from '../engine/mistakeReplay.js';
import PHChart from '../experiments/PHChart.jsx';
import en from '../locales/en.json';

function ScoreBar({ label, value }) {
  return (
    <div className="bar-row">
      <span>{label}</span>
      <div className="bar" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="fill" style={{ width: `${value}%` }} />
      </div>
      <strong>{Math.round(value)}</strong>
    </div>
  );
}

export default function Result({ result, syncStatus, onAgain, onDashboard }) {
  const { t } = useI18n();
  const { config, state, score, prediction, trail, mistakes, studentName } = result;
  const [openStep, setOpenStep] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const curve = useMemo(() => titrationCurve(config), [config]);
  const replay = useMemo(() => buildReplay(state.log, config), [state, config]);
  const eq = { volume: equivalenceVolume(config), pH: equivalencePH(config) };
  const truth = score.truth;

  const download = async () => {
    setDownloading(true);
    try {
      const { downloadReport } = await import('../services/reportService.js'); // loaded only when needed
      downloadReport({
        studentName,
        config,
        score,
        prediction,
        curve,
        mistakes: mistakes.map((m) => ({
          label: en[`mistake.${m.id}.name`],
          count: m.count,
          severity: m.severity,
        })),
      });
    } finally {
      setDownloading(false);
    }
  };

  const actionLabel = (action) =>
    t(`actname.${action.type}`, { v: action.volume !== undefined ? action.volume : '' });

  return (
    <main className="page">
      <h1>{t('result.title')}</h1>

      <section className="panel score-head">
        <div className="big-score">
          <span>{t('result.total')}</span>
          <strong data-testid="total">{score.total}</strong>
        </div>
        <div className="big-score">
          <span>{t('result.grade')}</span>
          <strong>{score.grade}</strong>
        </div>
        <div className="bars">
          {Object.entries(score.components).map(([key, value]) => (
            <ScoreBar key={key} label={t(`comp.${key}`)} value={value} />
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>{t('result.truthHeading')}</h2>
        <ul className="plain">
          <li>{t('result.endpoint', { v: truth.endpointVolume, eq: truth.equivalenceVolume })}</li>
          {config.mode === 'mystery' && result.reportedConcentration != null && (
            <li>{t('result.conc', { c: result.reportedConcentration, trueC: truth.trueConcentration })}</li>
          )}
          <li>
            {prediction != null
              ? t('result.eqPH', { actual: truth.equivalencePH, pred: prediction })
              : t('result.eqPHOnly', { actual: truth.equivalencePH })}
          </li>
        </ul>
        <h3>{t('result.curve')}</h3>
        <PHChart
          points={trail}
          curve={curve}
          eq={eq}
          xLabel={t('lab.volumeAxis')}
          eqLabel={t('result.curveEq')}
        />
      </section>

      <section className="panel">
        <h2>{t('result.mistakes')}</h2>
        {mistakes.length === 0 && <p className="ok-text">{t('result.noMistakes')}</p>}
        <ul className="list">
          {mistakes.map((m) => (
            <li key={m.id}>
              <span>
                <span className={`badge ${m.severity}`}>{t(`sev.${m.severity}`)}</span> {t(`mistake.${m.id}.name`)}
              </span>
              <strong>{t('result.times', { n: m.count })}</strong>
            </li>
          ))}
        </ul>
      </section>

      {replay.length > 0 && (
        <section className="panel">
          <h2>{t('result.replay')}</h2>
          <ol className="replay">
            {replay.map((step) => {
              const open = openStep === step.index;
              return (
                <li key={step.index} className={open ? 'open' : ''}>
                  <button
                    type="button"
                    className="replay-head"
                    aria-expanded={open}
                    onClick={() => setOpenStep(open ? null : step.index)}
                  >
                    <span>
                      {t('result.step', { n: step.index + 1 })}: {actionLabel(step.action)}
                    </span>
                    <span className="muted">{t(`mistake.${step.mistakes[0].id}.name`)}</span>
                  </button>
                  {open && (
                    <div className="replay-body">
                      <p className="muted">{t('result.atVolume', { v: step.volumeAfter.toFixed(2), ph: step.pHAfter })}</p>
                      {step.mistakes.map((m) => (
                        <div key={m.id} className={`msg ${VIOLATIONS[m.id].severity}`}>
                          <strong>{t(`mistake.${m.id}.name`)}</strong>
                          <p>
                            <em>{t('result.why')}:</em> {t(m.whyKey)}
                          </p>
                          <p>
                            <em>{t('result.fix')}:</em> {t(m.fixKey)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <section className="panel">
        <h2>{t('result.correct')}</h2>
        <ol className="steps">
          {CORRECT_PROCEDURE.map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ol>
      </section>

      <p className="muted">
        {t('result.saved')} {syncStatus === 'synced' && t('result.synced')}
      </p>
      <div className="row wrap">
        <button type="button" className="btn primary" onClick={download} disabled={downloading}>
          {t('result.download')}
        </button>
        <button type="button" className="btn" onClick={onAgain}>
          {t('result.again')}
        </button>
        <button type="button" className="btn ghost" onClick={onDashboard}>
          {t('result.backDash')}
        </button>
      </div>
      <p className="muted small-text">{t('result.reportNote')}</p>
    </main>
  );
}
