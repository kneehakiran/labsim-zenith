// Lab notebook / report generation. jsPDF works fully offline, so it fits the PWA goal.
// jsPDF's default fonts do not contain Telugu glyphs, so the PDF is written in English.

import { jsPDF } from 'jspdf';
import { round } from '../engine/chemistry.js';

/**
 * @param {object} data { studentName, config, score, mistakes, curve (sampled), prediction }
 * @returns {jsPDF}
 */
export function buildReport(data) {
  const { studentName, config, score, mistakes, prediction } = data;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 18;
  const line = (text, size = 11, bold = false, gap = 7) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    const wrapped = doc.splitTextToSize(text, 175);
    doc.text(wrapped, 18, y);
    y += gap * wrapped.length;
    if (y > 275) {
      doc.addPage();
      y = 18;
    }
  };

  line('LabSim - Lab Notebook', 18, true, 9);
  line(`Student: ${studentName}`);
  line(`Date: ${new Date().toLocaleString()}`);
  line(`Mode: ${config.mode}`, 11, false, 10);

  line('Aim', 13, true);
  line('To determine the concentration of an acid solution by titration against a standard sodium hydroxide solution.', 11, false, 6);
  y += 3;

  line('Setup', 13, true);
  line(`Analyte: ${config.analyte.volume} mL of ${config.mode === 'mystery' ? 'unknown acid' : config.analyte.name}`, 11, false, 6);
  line(`Titrant: ${config.titrant.conc} mol/L ${config.titrant.name}`, 11, false, 10);

  line('Results', 13, true);
  const t = score.truth;
  line(`Endpoint reading: ${t.endpointVolume} mL (true equivalence point: ${t.equivalenceVolume} mL)`, 11, false, 6);
  line(`Calculated concentration: ${t.studentConcentration} mol/L (true value: ${t.trueConcentration} mol/L)`, 11, false, 6);
  if (prediction != null) line(`Predicted equivalence pH: ${prediction} (actual: ${t.equivalencePH})`, 11, false, 6);
  y += 4;

  line('Scores', 13, true);
  for (const [k, v] of Object.entries(score.components)) line(`${k}: ${v} / 100`, 11, false, 6);
  line(`Total: ${score.total} / 100 (grade ${score.grade})`, 12, true, 10);

  line('Mistakes to review', 13, true);
  if (!mistakes.length) line('None. Excellent technique.', 11, false, 6);
  for (const m of mistakes) line(`- ${m.label} x${m.count} (${m.severity})`, 11, false, 6);
  y += 6;

  drawCurve(doc, data.curve, config, y);
  return doc;
}

function drawCurve(doc, curve, config, top) {
  if (!curve?.length) return;
  let y0 = top;
  if (y0 > 180) {
    doc.addPage();
    y0 = 18;
  }
  const x0 = 28;
  const w = 150;
  const h = 70;
  const maxV = Math.max(...curve.map((p) => p.volume));
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('pH curve', 18, y0);
  const oy = y0 + 6;
  doc.setDrawColor(120);
  doc.rect(x0, oy, w, h);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  for (let ph = 0; ph <= 14; ph += 2) {
    const yy = oy + h - (ph / 14) * h;
    doc.text(String(ph), x0 - 6, yy + 1);
    doc.setDrawColor(225);
    doc.line(x0, yy, x0 + w, yy);
  }
  for (let v = 0; v <= maxV; v += 10) {
    doc.text(String(v), x0 + (v / maxV) * w - 1, oy + h + 5);
  }
  doc.text('Volume of NaOH (mL)', x0 + w / 2 - 15, oy + h + 10);
  doc.setDrawColor(0, 90, 200);
  doc.setLineWidth(0.6);
  const pts = curve.map((p) => [x0 + (p.volume / maxV) * w, oy + h - (Math.min(14, Math.max(0, p.pH)) / 14) * h]);
  for (let i = 1; i < pts.length; i++) doc.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
  doc.setLineWidth(0.2);
}

export function downloadReport(data, filename = 'labsim-report.pdf') {
  buildReport(data).save(filename);
}

/** Student-visible summary text, also handy for tests. */
export function reportSummary(score) {
  return `${score.total}/100 (${score.grade}), endpoint ${round(score.truth.endpointVolume, 2)} mL`;
}
