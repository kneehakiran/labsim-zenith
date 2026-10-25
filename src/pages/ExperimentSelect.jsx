import { useState } from 'react';
import { useI18n } from '../i18n.jsx';

const MODES = ['guided', 'mystery', 'trap'];
const ACIDS = ['hcl', 'acetic'];

/** preset: optional { mode, acid } from a faculty assignment, which fixes those choices. */
export default function ExperimentSelect({ preset, onStart, onBack }) {
  const { t } = useI18n();
  const [mode, setMode] = useState(preset?.mode ?? 'guided');
  const [acid, setAcid] = useState(preset?.acid ?? 'hcl');

  return (
    <main className="page">
      <button type="button" className="btn ghost" onClick={onBack}>
        {t('login.back')}
      </button>
      <h1>{t('exp.title')}</h1>

      <div className="cards">
        <div className="card selected" aria-current="true">
          <h3>{t('exp.titration')}</h3>
          <p>{t('exp.titrationDesc')}</p>
        </div>
        <div className="card disabled" aria-disabled="true">
          <h3>{t('exp.ohm')}</h3>
          <p className="muted">{t('exp.soon')}</p>
        </div>
        <div className="card disabled" aria-disabled="true">
          <h3>{t('exp.pendulum')}</h3>
          <p className="muted">{t('exp.soon')}</p>
        </div>
      </div>

      <section className="panel">
        <h2>{t('exp.mode')}</h2>
        <div className="cards">
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              className={`card choice${mode === m ? ' selected' : ''}`}
              aria-pressed={mode === m}
              disabled={Boolean(preset)}
              onClick={() => setMode(m)}
            >
              <h3>{t(`mode.${m}`)}</h3>
              <p>{t(`mode.${m}Desc`)}</p>
            </button>
          ))}
        </div>

        {mode !== 'mystery' && (
          <>
            <h2>{t('exp.acid')}</h2>
            <div className="cards two">
              {ACIDS.map((a) => (
                <button
                  key={a}
                  type="button"
                  className={`card choice${acid === a ? ' selected' : ''}`}
                  aria-pressed={acid === a}
                  disabled={Boolean(preset)}
                  onClick={() => setAcid(a)}
                >
                  <h3>{t(`acid.${a}`)}</h3>
                </button>
              ))}
            </div>
          </>
        )}

        <button type="button" className="btn primary large" onClick={() => onStart({ mode, acid })}>
          {t('exp.start')}
        </button>
      </section>
    </main>
  );
}
