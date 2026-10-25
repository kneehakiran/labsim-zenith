import { useCallback, useEffect, useState } from 'react';
import Navbar from './components/Navbar.jsx';
import StudentDashboard from './pages/StudentDashboard.jsx';
import ExperimentSelect from './pages/ExperimentSelect.jsx';
import Result from './pages/Result.jsx';
import Titration from './experiments/Titration.jsx';
import { ACIDS, generateMysterySample, makeConfig } from './engine/chemistry.js';
import { scoreSession } from './engine/scoring.js';
import { summarizeMistakes } from './engine/mistakeReplay.js';
import { markAttemptSynced, saveAttempt, unsyncedAttempts } from './services/storage.js';
import { guestSession, setToken, syncPending } from './services/api.js';

// No login: the app opens straight on the student dashboard.
const session = guestSession('student');
setToken(session.token);
const profile = session.user;

function buildConfig({ mode, acid }) {
  if (mode === 'mystery') return generateMysterySample(Date.now());
  return makeConfig({ acid: ACIDS[acid] ?? ACIDS.hcl, conc: 0.1, volume: 25, titrantConc: 0.1, mode });
}

export default function App() {
  const [route, setRoute] = useState('student'); // student | select | lab | result
  const [preset, setPreset] = useState(null);
  const [config, setConfig] = useState(null);
  const [result, setResult] = useState(null);
  const [syncStatus, setSyncStatus] = useState('local');
  const [labKey, setLabKey] = useState(0);

  const trySync = useCallback(async () => syncPending(await unsyncedAttempts(profile.roll_no), markAttemptSynced), []);

  useEffect(() => {
    window.addEventListener('online', trySync);
    trySync();
    return () => window.removeEventListener('online', trySync);
  }, [trySync]);

  const dashboard = () => setRoute('student');

  const startLab = (choice) => {
    setConfig(buildConfig(choice));
    setLabKey((k) => k + 1);
    setRoute('lab');
  };

  const finishLab = async ({ state, config: cfg, prediction, reportedConcentration, trail }) => {
    const score = scoreSession({ state, config: cfg, prediction, reportedConcentration });
    const mistakes = summarizeMistakes(state.log);
    const attempt = {
      experiment: 'titration',
      mode: cfg.mode,
      acid: cfg.mode === 'mystery' ? null : cfg.analyte.name,
      score: score.total,
      grade: score.grade,
      components: score.components,
      mistakes: mistakes.map(({ id, count, severity }) => ({ id, count, severity })),
      truth: score.truth,
      endedAt: new Date().toISOString(),
    };

    setResult({ config: cfg, state, score, prediction, reportedConcentration, trail, mistakes, studentName: profile.name });
    setSyncStatus('local');
    setRoute('result');

    await saveAttempt(profile.roll_no, attempt);
    if ((await trySync()) > 0) setSyncStatus('synced');
  };

  let page;
  switch (route) {
    case 'select':
      page = <ExperimentSelect preset={preset} onStart={startLab} onBack={dashboard} />;
      break;
    case 'lab':
      page = <Titration key={labKey} config={config} onFinish={finishLab} onExit={dashboard} />;
      break;
    case 'result':
      page = <Result result={result} syncStatus={syncStatus} onAgain={() => setRoute('select')} onDashboard={dashboard} />;
      break;
    default:
      page = (
        <StudentDashboard
          profile={profile}
          onStart={() => {
            setPreset(null);
            setRoute('select');
          }}
          onStartAssignment={(a) => {
            setPreset({ mode: a.mode, acid: a.acid });
            setRoute('select');
          }}
        />
      );
  }

  return (
    <>
      <Navbar profile={null} onHome={dashboard} onSwitchRole={() => {}} />
      <div id="main">{page}</div>
    </>
  );
}
