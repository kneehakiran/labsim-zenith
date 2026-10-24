# LabSim Chemistry Prototype

LabSim is a browser-based, bilingual (English/Telugu) chemistry learning prototype. It models four planned practicals: acid-base titration, salt analysis, reaction rate, and a Daniell cell. It includes a pre-lab safety check, parameter-based readings, procedure/safety/accuracy scoring, action history, Mistake Replay prompts, local teacher insights, downloadable reports, and a PWA service worker.

## Run locally

1. Extract the archive and open the `LabSim` folder.
2. For a quick preview, open `index.html` in a modern browser.
3. To test offline installation and the service worker, serve the folder from a local web server, then open the displayed local URL. For example, with Python installed: `python -m http.server 8000` and visit `http://localhost:8000`.
4. In Chromium-based browsers, use the browser's Install option after the page loads. Reload once while online/local to let the service worker cache the files; it will then work offline.

## Important validation note

This is an educational software prototype, not a substitute for supervised laboratory work, school safety policy, material safety data sheets, or qualified professional judgment. A qualified chemistry educator must validate every procedure, safety statement, formula, concentration range, translation, and experimental outcome before classroom or laboratory deployment.
