// Keeps the phone and the coach-data repo in step.
//
// On open:  push anything waiting, then pull split.json and state.json so
//           changes Claude made show up. Offline, the cached copies are used.
// On save:  the session goes into history and the outbox first (on the
//           phone), then the outbox is pushed. If that fails, it retries on
//           the next open.

import * as store from './storage.js';
import * as gh from './github.js';
import { sessionToCSV, parseCSV, rowsToSession } from './csv.js';
import { nextState } from './progression.js';

function announce() {
  window.dispatchEvent(new CustomEvent('coach:sync'));
}

export function pendingCount() {
  return store.getOutbox().length + (store.isSplitDirty() ? 1 : 0);
}

let running = null;

// Pull on open. Returns 'local' | 'synced' | 'offline' | 'error'.
export function syncOnOpen() {
  if (!store.isConnected()) return Promise.resolve('local');
  if (running) return running;
  running = (async () => {
    try {
      await flushOutbox();
      if (store.isSplitDirty()) await pushSplit();
      if (!store.isSplitDirty()) {
        const remote = await gh.getJSON('split.json');
        if (remote) store.setSplit(remote.data);
        else await pushSplit(); // first run against an empty repo
      }
      if (store.getOutbox().length === 0) {
        const remoteState = await gh.getJSON('state.json');
        if (remoteState) store.setState(remoteState.data);
      }
      return 'synced';
    } catch (err) {
      console.warn('Sync on open failed', err);
      return err.status === 0 ? 'offline' : 'error';
    } finally {
      running = null;
      announce();
    }
  })();
  return running;
}

// Save a finished session. Always succeeds on the phone; pushing may not.
// Returns { synced: boolean, readyToIncrease: [names], session }.
export async function saveSession(session) {
  const split = store.getSplit();
  const unit = split?.units || 'lb';
  const state = store.getState();
  const touched = {};
  const ready = [];

  for (const ex of session.exercises) {
    const next = nextState(state[ex.id], ex, session.date);
    if (next && next !== state[ex.id]) {
      touched[ex.id] = next;
      if (next.readyToIncrease) ready.push(ex.name);
    }
  }

  store.setState({ ...state, ...touched });

  const saved = {
    ...session,
    unit,
    savedAt: new Date().toISOString(),
    synced: false,
    path: null,
  };
  store.addToHistory(saved);

  store.setOutbox([
    ...store.getOutbox(),
    { sessionId: saved.id, date: saved.date, dayName: saved.dayName, csv: sessionToCSV(saved, unit), touched, path: null },
  ]);
  store.clearCurrent();
  announce();

  let synced = false;
  if (store.isConnected()) {
    try {
      await flushOutbox();
      synced = !store.getOutbox().some((o) => o.sessionId === saved.id);
    } catch (err) {
      console.warn('Save sync failed', err);
    }
  }
  announce();
  return { synced, readyToIncrease: ready, session: saved };
}

// Find a free file name: logs/2026/2026-10-21.csv, then -2, -3, ...
async function freePath(date) {
  const year = date.slice(0, 4);
  for (let n = 1; n < 50; n++) {
    const path = `logs/${year}/${date}${n === 1 ? '' : '-' + n}.csv`;
    if (!(await gh.getFile(path))) return path;
  }
  throw new Error('Too many sessions on one date');
}

// Push every waiting session. Stops at the first failure and keeps the rest.
export async function flushOutbox() {
  if (!store.isConnected()) return;
  let outbox = store.getOutbox();
  while (outbox.length) {
    const item = outbox[0];

    // 1. The CSV. Remember the path once it's written so a retry
    //    doesn't create a duplicate file.
    if (!item.path) {
      const path = await freePath(item.date);
      await gh.putFile(path, item.csv, `Log ${item.dayName} session ${item.date}`);
      item.path = path;
      store.setOutbox(outbox);
      store.updateHistoryItem(item.sessionId, { path });
    }

    // 2. state.json: start from GitHub's copy (Claude may have edited it)
    //    and apply only the exercises this session changed.
    if (Object.keys(item.touched).length) {
      const remote = await gh.getJSON('state.json');
      const merged = { ...(remote?.data || {}), ...item.touched };
      await gh.putFile('state.json', JSON.stringify(merged, null, 2) + '\n',
        `Update working weights after ${item.date}`, remote?.sha);
      // Keep later unsynced sessions' changes on top locally.
      const laterTouched = Object.assign({}, ...outbox.slice(1).map((o) => o.touched));
      store.setState({ ...merged, ...laterTouched });
    }

    outbox = outbox.slice(1);
    store.setOutbox(outbox);
    store.updateHistoryItem(item.sessionId, { synced: true });
    announce();
  }
}

// Push the split after editing it on the phone.
export async function pushSplit() {
  const split = store.getSplit();
  if (!split || !store.isConnected()) return false;
  const remote = await gh.getFile('split.json');
  await gh.putFile('split.json', JSON.stringify(split, null, 2) + '\n',
    `Update split from the app (${split.name})`, remote?.sha);
  store.setSplitDirty(false);
  announce();
  return true;
}

// Save a split edited in the builder. Returns true if it reached GitHub.
export async function saveSplit(split) {
  store.setSplit(split);
  store.setSplitDirty(true);
  announce();
  if (!store.isConnected()) {
    store.setSplitDirty(false); // nothing to sync to in local-only mode
    return false;
  }
  try {
    return await pushSplit();
  } catch (err) {
    console.warn('Split push failed', err);
    return false;
  }
}

// Load any session logs on GitHub that aren't on this phone yet
// (for example after reinstalling or on a second device).
export async function pullHistory() {
  if (!store.isConnected()) return 0;
  const known = new Set(store.getHistory().map((s) => s.path).filter(Boolean));
  const years = (await gh.listDir('logs')).filter((d) => d.type === 'dir');
  let added = 0;
  for (const y of years) {
    const files = (await gh.listDir(y.path)).filter((f) => f.name.endsWith('.csv'));
    for (const f of files) {
      if (known.has(f.path)) continue;
      const file = await gh.getFile(f.path);
      const session = file && rowsToSession(parseCSV(file.text), f.path);
      if (session) {
        store.addToHistory(session);
        added++;
      }
    }
  }
  return added;
}
