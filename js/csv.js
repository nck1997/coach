// Session CSV: one row per set. Plain CSV with a header row, quoted where needed.

export const COLUMNS = [
  'date', 'day_id', 'day_name', 'exercise_id', 'exercise_name', 'set_number',
  'weight', 'unit', 'reps', 'rep_min', 'rep_max', 'completed', 'off_plan',
  'swapped_from', 'note',
];

function cell(v) {
  if (v == null) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Rows (as objects keyed by column) for one session.
export function sessionRows(session, unit) {
  const rows = [];
  for (const ex of session.exercises) {
    ex.sets.forEach((s, i) => {
      rows.push({
        date: session.date,
        day_id: session.dayId,
        day_name: session.dayName,
        exercise_id: ex.id,
        exercise_name: ex.name,
        set_number: i + 1,
        weight: s.weight ?? '',
        unit,
        reps: s.done ? s.reps : '', // prefilled reps on a skipped set aren't real
        rep_min: ex.repMin,
        rep_max: ex.repMax,
        completed: s.done ? 'true' : 'false',
        off_plan: ex.offPlan ? 'true' : 'false',
        swapped_from: ex.swappedFrom || '',
        note: ex.note || '',
      });
    });
  }
  return rows;
}

export function toCSV(rows) {
  const lines = [COLUMNS.join(',')];
  for (const r of rows) lines.push(COLUMNS.map((c) => cell(r[c])).join(','));
  return lines.join('\n') + '\n';
}

export function sessionToCSV(session, unit) {
  return toCSV(sessionRows(session, unit));
}

// Minimal CSV parser (handles quotes, escaped quotes, and newlines in quotes).
export function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows.filter((r) => r.length > 1 || r[0] !== '');
  if (!header) return [];
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

// Turn parsed CSV rows back into a session object (used to load history from GitHub).
export function rowsToSession(rows, path) {
  if (!rows.length) return null;
  const first = rows[0];
  const byEx = new Map();
  for (const r of rows) {
    if (!byEx.has(r.exercise_id)) {
      byEx.set(r.exercise_id, {
        id: r.exercise_id,
        name: r.exercise_name,
        repMin: Number(r.rep_min),
        repMax: Number(r.rep_max),
        offPlan: r.off_plan === 'true',
        swappedFrom: r.swapped_from || null,
        note: r.note || '',
        sets: [],
      });
    }
    byEx.get(r.exercise_id).sets.push({
      weight: r.weight === '' ? null : Number(r.weight),
      reps: r.reps === '' ? null : Number(r.reps),
      done: r.completed === 'true',
    });
  }
  return {
    id: path,
    path,
    date: first.date,
    dayId: first.day_id,
    dayName: first.day_name,
    unit: first.unit,
    exercises: [...byEx.values()],
    synced: true,
  };
}
