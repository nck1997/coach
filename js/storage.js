// Local storage for everything on the device.
// localStorage keeps it simple: a few JSON blobs under "coach." keys.
// Every tap during a workout writes here immediately, so a dead zone at the
// gym never loses a set.

const PREFIX = 'coach.';

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    if (value === undefined || value === null) localStorage.removeItem(PREFIX + key);
    else localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch (err) {
    console.error('Could not write to local storage', err);
  }
}

// The program (split.json).
export const getSplit = () => read('split', null);
export const setSplit = (split) => write('split', split);

// True when the split was edited on the phone and hasn't reached GitHub yet.
export const isSplitDirty = () => read('splitDirty', false);
export const setSplitDirty = (v) => write('splitDirty', !!v);

// Working weights (state.json).
export const getState = () => read('state', {});
export const setState = (state) => write('state', state);

// Past sessions, newest first.
export const getHistory = () => read('history', []);
export const setHistory = (h) => write('history', h);
export function addToHistory(session) {
  const h = getHistory().filter((s) => s.id !== session.id);
  h.push(session);
  h.sort((a, b) => (b.date + (b.savedAt || '')).localeCompare(a.date + (a.savedAt || '')));
  setHistory(h);
}
export function updateHistoryItem(id, patch) {
  setHistory(getHistory().map((s) => (s.id === id ? { ...s, ...patch } : s)));
}

// Which variation he last used in place of a planned exercise, keyed by the
// planned id: { "machine-preacher-curl-single-arm": "barbell-preacher-curl" }.
// Phone only. The next workout starts on that variation.
export const getVariants = () => read('variants', {});
export function rememberVariant(plannedId, chosenId) {
  const v = getVariants();
  if (!chosenId || chosenId === plannedId) delete v[plannedId];
  else v[plannedId] = chosenId;
  write('variants', v);
}

// The in-progress workout, if any.
export const getCurrent = () => read('current', null);
export const setCurrent = (session) => write('current', session);
export const clearCurrent = () => write('current', null);

// Sessions saved on the phone but not yet pushed to GitHub.
export const getOutbox = () => read('outbox', []);
export const setOutbox = (o) => write('outbox', o);

// Settings: token, owner, repo.
export const getSettings = () => read('settings', { token: '', owner: '', repo: 'coach-data' });
export const setSettings = (s) => write('settings', s);

export function isConnected() {
  const s = getSettings();
  return !!(s.token && s.owner && s.repo);
}

export function resetAll() {
  Object.keys(localStorage)
    .filter((k) => k.startsWith(PREFIX))
    .forEach((k) => localStorage.removeItem(k));
}
