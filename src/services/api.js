// Local data layer: no server and no sign in. Everything is kept in this browser (localStorage).
// Same function names as the old server client, so the pages did not need to change.
import seedCsv from '../data/students.csv?raw';

export class ApiError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

let token = null;
export const setToken = (value) => {
  token = value || null;
};

const KEY = 'labsim.local.';
const read = (name, fallback) => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY + name));
    return v ?? fallback;
  } catch {
    return fallback;
  }
};
const write = (name, value) => {
  try {
    localStorage.setItem(KEY + name, JSON.stringify(value));
  } catch {
    /* storage full or blocked */
  }
};

const mk = (roll_no, name, extra = {}) => ({
  roll_no: roll_no.trim().toUpperCase(),
  name: name.trim(),
  department: 'CSE',
  year: 4,
  semester: 7,
  section: 'A',
  ...extra,
});

function students() {
  let list = read('students', null);
  if (!list) {
    list = [mk('GUEST', 'Guest Student')];
    for (const line of seedCsv.split(/\r?\n/).slice(1)) {
      const [roll, ...rest] = line.split(',');
      if (roll && rest.join(',').trim()) list.push(mk(roll, rest.join(',')));
    }
    write('students', list);
  }
  return list;
}

const num = (v) => Number.parseInt(v, 10);

// ---- session (no password: choosing a role is enough) ----
export const guestSession = (role) =>
  role === 'faculty'
    ? { token: 'local:faculty', user: { role: 'faculty', name: 'Faculty' } }
    : { token: 'local:GUEST', user: { role: 'student', ...students().find((s) => s.roll_no === 'GUEST') } };
export const fetchMe = async () => null;
export const logout = async () => null;

// ---- students ----
export async function listStudents(filters = {}) {
  const q = (filters.q || '').toLowerCase();
  return students().filter(
    (s) => (!q || s.name.toLowerCase().includes(q) || s.roll_no.toLowerCase().includes(q)) && (!filters.department || s.department === filters.department),
  );
}

function validate(s) {
  if (!s.roll_no?.trim() || !s.name?.trim() || !s.department?.trim() || !s.section?.trim() || !(num(s.year) > 0) || !(num(s.semester) > 0)) {
    throw new ApiError(422, 'invalid');
  }
  return mk(s.roll_no, s.name, {
    department: s.department.trim(),
    year: num(s.year),
    semester: num(s.semester),
    section: s.section.trim().toUpperCase(),
  });
}

export async function addStudent(s) {
  const next = validate(s);
  const list = students();
  if (list.some((x) => x.roll_no === next.roll_no)) throw new ApiError(409, 'duplicate');
  write('students', [...list, next]);
  return next;
}

export async function updateStudent(rollNo, fields) {
  const roll = rollNo.trim().toUpperCase();
  const list = students();
  const i = list.findIndex((x) => x.roll_no === roll);
  if (i < 0) throw new ApiError(404, 'not_found');
  list[i] = validate({ ...list[i], ...fields, roll_no: roll });
  write('students', list);
  return list[i];
}

export async function deleteStudent(rollNo) {
  const roll = rollNo.trim().toUpperCase();
  write('students', students().filter((x) => x.roll_no !== roll));
  write('attempts', read('attempts', []).filter((a) => a.roll_no !== roll));
  return null;
}

export async function importStudents(csv) {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length && /^roll/i.test(lines[0].trim())) lines.shift();
  const out = { created: 0, skipped: 0, errors: [] };
  for (const [i, line] of lines.entries()) {
    const c = line.split(',').map((x) => x.trim());
    if (c.length < 6) {
      out.skipped += 1;
      out.errors.push({ line: i + 1, reason: 'expected 6 columns' });
      continue;
    }
    try {
      await addStudent({ roll_no: c[0], name: c[1], department: c[2], year: c[3], semester: c[4], section: c[5] });
      out.created += 1;
    } catch (e) {
      out.skipped += 1;
      out.errors.push({ line: i + 1, reason: e.code === 'duplicate' ? 'roll number already registered' : 'invalid values' });
    }
  }
  return out;
}

// ---- results ----
export async function fetchAttempts() {
  const byRoll = Object.fromEntries(students().map((s) => [s.roll_no, s]));
  return read('attempts', [])
    .filter((a) => byRoll[a.roll_no])
    .map((a) => ({ client_id: a.client_id, student: byRoll[a.roll_no], attempt: a.attempt }));
}

export async function pushAttempt(clientId, attempt) {
  const roll = token?.startsWith('local:') ? token.slice(6) : 'GUEST';
  const all = read('attempts', []);
  if (!all.some((a) => a.client_id === clientId)) all.push({ client_id: clientId, roll_no: roll, attempt });
  write('attempts', all);
  return { ok: true };
}

// ---- assignments ----
export const fetchAssignments = async () => read('assignments', []);
export async function createAssignment(a) {
  const list = read('assignments', []);
  const row = { id: Date.now(), title: a.title, mode: a.mode, acid: a.acid, created_at: new Date().toISOString() };
  write('assignments', [row, ...list]);
  return row;
}
export async function deleteAssignment(id) {
  write('assignments', read('assignments', []).filter((a) => a.id !== id));
  return null;
}

/** Save attempts that are still marked "not synced" (here this just means copying them into the shared store). */
export async function syncPending(pending, markSynced) {
  let sent = 0;
  for (const record of pending) {
    const { id, profileId, synced, ...attempt } = record; // eslint-disable-line no-unused-vars
    await pushAttempt(id, attempt);
    await markSynced?.(record);
    sent += 1;
  }
  return sent;
}
