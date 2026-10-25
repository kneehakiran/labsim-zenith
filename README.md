# LabSim

Browser-based virtual laboratory (Progressive Web App). First practical: **acid-base titration**
(strong acid HCl or weak acid CH3COOH against NaOH) with Guided, Mystery Sample and Error-Hunt modes.

## Run it

You need Node 20+ and Python 3.10+. Open two terminals.

**Terminal 1: backend** (see `backend/README.md`)

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python seed.py                                          # loads the 62 students and 7 faculty (data/*.csv)
uvicorn app.main:app --port 8000
```

**Terminal 2: website**

```bash
npm install
npm run dev          # open the address it prints; /api is forwarded to the backend
```

Other commands: `npm run build`, `npm run preview` (installable and works offline), and
`npm run test:all` (engine, backend and real-server UI tests; needs the backend's Python packages,
`pip install -r backend/requirements-dev.txt`).

## How sign in works

In both cases the **password is the same as the user name**.

| Who | User name | Password | Example |
| --- | --- | --- | --- |
| **Student** | roll number | the same roll number (capitals do not matter) | `232U1A3712` / `232U1A3712` |
| **Faculty** | name **without Mr./Ms. and without initials** | the same name | `Sai Prasad Reddy` / `Sai Prasad Reddy`, or `Sahaja` / `Sahaja` |

All seven faculty user names: `Sai Prasad Reddy`, `Chaithanya`, `Venkateswarlu`, `Suneel Kumar`, `Sahaja`,
`Harikrishna`, `Pravallika`. Capitals and dots do not matter, and typing the full name with title and
initials (`Mr. T. Sai Prasad Reddy`) works too.

- The lists come from the college PDFs: `backend/data/students.csv` (62 students) and
  `backend/data/faculty.csv` (7 faculty). `python seed.py` loads them; running it again is safe.
- A roll number that is not on the list is refused. Faculty can add, edit, remove or import more students
  in the **Students** tab, and everything is saved in the backend database.
- The PDFs do not give department, year, semester or section, so students are loaded as **CSE, year 4,
  semester 7, section A**. Faculty can correct any student in the Students tab.
- Students can practise offline. Results are kept on the device and uploaded automatically when the
  connection returns; faculty see them on the **Performance** tab.

## What is where

| Path | Purpose |
| --- | --- |
| `src/engine/chemistry.js` | Exact charge-balance pH model, equivalence point, indicators, mystery samples |
| `src/engine/safetyRules.js` | Procedure and safety rules, session state, Error-Hunt faults |
| `src/engine/scoring.js` | Prediction, procedure, safety and endpoint-accuracy scores |
| `src/engine/mistakeReplay.js` | Turns the action log into a step-by-step review |
| `src/experiments/` | Titration screen, burette, flask, pH chart (SVG) |
| `src/pages/` | Home, login, student and faculty dashboards, experiment selection, results |
| `src/services/storage.js` | Offline copy of a student's results on the device (IndexedDB, localStorage fallback) |
| `src/services/reportService.js` | PDF lab notebook (jsPDF, loaded only when needed) |
| `src/services/api.js` | Client for the backend: sign in, students, results, assignments |
| `backend/` | FastAPI + SQLite server (accounts, students, results) |
| `src/locales/en.json`, `te.json` | English and Telugu text, same keys in both |

## Current limits

- Passwords are the same as the user names (roll number for students, name for faculty), so this suits
  practice, not official marks. Anyone who knows a faculty name can sign in as that faculty member. See
  `backend/README.md` for how to harden it.
- Students and faculty need an internet connection to sign in. Students can then practise offline.
- The PDF report is in English (the default PDF fonts have no Telugu glyphs).
- Only the titration experiment exists. Ohm's law and the pendulum show as "coming soon".

## Adding an experiment

An experiment is a config object plus a calculation function in `src/engine/`, a rules file for its
procedure, and a screen in `src/experiments/`. Reuse `PHChart`, scoring, mistake replay, storage and
the result page.
