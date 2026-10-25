import { useEffect, useState } from 'react';
import { useI18n } from '../i18n.jsx';
import { fetchAssignments } from '../services/api.js';
import { cacheAssignments, cachedAssignments, listAttempts, summarizeAttempts } from '../services/storage.js';
import { componentAverages, downloadText, toCsv } from '../services/analytics.js';

const TABS = ['home', 'exp', 'perf', 'notebook', 'help', 'profile'];
const SKILLS = ['prediction', 'procedure', 'safety', 'accuracy'];

export default function StudentDashboard({ profile, onStart, onStartAssignment }) {
  const { t } = useI18n();
  const [tab, setTab] = useState('home');
  const [attempts, setAttempts] = useState(null);
  const [assignments, setAssignments] = useState(() => cachedAssignments());

  useEffect(() => {
    let alive = true;
    listAttempts(profile.roll_no).then((list) => alive && setAttempts(list));
    // Latest assignments from the server; if we are offline, the saved copy above stays on screen.
    fetchAssignments()
      .then((list) => {
        cacheAssignments(list);
        if (alive) setAssignments(list);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [profile.roll_no]);

  if (!attempts) return <main className="page" />;
  const summary = summarizeAttempts(attempts);
  const comps = componentAverages(attempts);
  const weak = SKILLS.filter((k) => comps[k] != null && comps[k] < 70);

  const downloadNotebook = () => {
    const rows = [['Date', 'Mode', 'Acid', 'Score', 'Grade', ...SKILLS, 'Mistakes']];
    for (const a of attempts) {
      rows.push([
        a.endedAt,
        a.mode,
        a.acid ?? 'mystery',
        a.score,
        a.grade,
        ...SKILLS.map((k) => a.components?.[k] ?? ''),
        (a.mistakes || []).map((m) => `${m.id} x${m.count}`).join('; '),
      ]);
    }
    downloadText(toCsv(rows), `labsim-notebook-${profile.roll_no}.csv`);
  };

  return (
    <main className="page">
      <h1>{t('dash.welcome', { name: profile.name })}</h1>

      <div className="tabs" role="tablist">
        {TABS.map((id) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            {t(`stu.tab.${id}`)}
          </button>
        ))}
      </div>

      {tab === 'home' && (
        <>
          <div className="stats">
            <div className="stat">
              <span>{t('dash.attempts')}</span>
              <strong>{summary.count}</strong>
            </div>
            <div className="stat">
              <span>{t('dash.best')}</span>
              <strong>{summary.best}</strong>
            </div>
            <div className="stat">
              <span>{t('dash.average')}</span>
              <strong>{summary.average}</strong>
            </div>
            <div className="stat">
              <span>{t('stu.skills')}</span>
              <strong>{weak.length}</strong>
            </div>
          </div>
          <button type="button" className="btn primary large" onClick={onStart}>
            {t('dash.start')}
          </button>
          <section className="panel">
            <h2>{t('dash.assigned')}</h2>
            {assignments.length === 0 && <p className="muted">{t('dash.noAssigned')}</p>}
            <ul className="list">
              {assignments.map((a) => (
                <li key={a.id}>
                  <span>
                    <strong>{a.title}</strong> <span className="muted">{t(`mode.${a.mode}`)}</span>
                  </span>
                  <button type="button" className="btn small" onClick={() => onStartAssignment(a)}>
                    {t('dash.startAssigned')}
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section className="panel">
            <h2>{t('dash.recent')}</h2>
            {attempts.length === 0 && <p className="muted">{t('dash.noneYet')}</p>}
            <ul className="list">
              {attempts.slice(0, 5).map((a) => (
                <li key={a.id}>
                  <span>
                    {t('exp.titration')} <span className="muted">({t(`mode.${a.mode}`)})</span>
                  </span>
                  <strong>
                    {a.score} ({a.grade})
                  </strong>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {tab === 'exp' && (
        <section className="panel">
          <h2>{t('stu.tab.exp')}</h2>
          <ul className="list">
            {['guided', 'mystery', 'trap'].map((m) => (
              <li key={m}>
                <span>
                  <strong>{t(`mode.${m}`)}</strong>
                  <br />
                  <span className="muted">{t(`mode.${m}Desc`)}</span>
                </span>
              </li>
            ))}
          </ul>
          <button type="button" className="btn primary large" onClick={onStart}>
            {t('dash.start')}
          </button>
        </section>
      )}

      {tab === 'perf' && (
        <section className="panel">
          <h2>{t('stu.tab.perf')}</h2>
          {attempts.length === 0 ? (
            <p className="muted">{t('dash.noneYet')}</p>
          ) : (
            <>
              <h3>{t('stu.compAvg')}</h3>
              <ul className="list">
                {SKILLS.filter((k) => comps[k] != null).map((k) => (
                  <li key={k}>
                    <span>{t(`comp.${k}`)}</span>
                    <strong>{comps[k]}</strong>
                  </li>
                ))}
              </ul>
              <p>{weak.length ? t('stu.focus', { skills: weak.map((k) => t(`comp.${k}`)).join(', ') }) : t('stu.allGood')}</p>
              <h3>{t('dash.repeated')}</h3>
              {summary.repeatedMistakes.length === 0 && <p className="muted">{t('dash.repeatedNone')}</p>}
              <ul className="list">
                {summary.repeatedMistakes.slice(0, 5).map((m) => (
                  <li key={m.id}>
                    <span>{t(`mistake.${m.id}.name`)}</span>
                    <strong>{t('result.times', { n: m.count })}</strong>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {tab === 'notebook' && (
        <section className="panel">
          <h2>{t('stu.tab.notebook')}</h2>
          <p className="muted">{t('stu.notebookNote')}</p>
          {attempts.length === 0 && <p className="muted">{t('dash.noneYet')}</p>}
          <ul className="list">
            {attempts.map((a) => (
              <li key={a.id}>
                <span>
                  {new Date(a.endedAt).toLocaleString()} <span className="muted">({t(`mode.${a.mode}`)})</span>
                  <br />
                  <span className="muted">{(a.mistakes || []).map((m) => t(`mistake.${m.id}.name`)).join(', ') || t('dash.repeatedNone')}</span>
                </span>
                <strong>
                  {a.score} ({a.grade})
                </strong>
              </li>
            ))}
          </ul>
          {attempts.length > 0 && (
            <button type="button" className="btn" onClick={downloadNotebook}>
              {t('stu.downloadNotebook')}
            </button>
          )}
        </section>
      )}

      {tab === 'help' && (
        <section className="panel">
          <h2>{t('stu.tab.help')}</h2>
          <ul className="list">
            {[1, 2, 3, 4].map((n) => (
              <li key={n}>{t(`stu.safety${n}`)}</li>
            ))}
          </ul>
          <p className="muted">{t('stu.langNote')}</p>
        </section>
      )}

      {tab === 'profile' && (
        <section className="panel details" aria-label={t('dash.details')}>
          <h2>{t('stu.tab.profile')}</h2>
          <dl>
            {[
              ['stu.name', profile.name],
              ['stu.roll', profile.roll_no],
              ['stu.department', profile.department],
              ['stu.year', profile.year],
              ['stu.semester', profile.semester],
              ['stu.section', profile.section],
            ].map(([key, value]) => (
              <div key={key}>
                <dt>{t(key)}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </main>
  );
}
