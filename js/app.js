// App entry: first-run setup, routing, tab bar, and sync on open.

import * as store from './storage.js';
import { coachDefault } from './templates.js';
import { syncOnOpen } from './sync.js';
import { renderToday } from './ui/today.js';
import { renderWorkout, releaseWakeLock } from './ui/workout.js';
import { renderSummary } from './ui/summary.js';
import { renderHistory, renderSessionDetail, renderExercise } from './ui/history.js';
import { renderSplit } from './ui/split.js';
import { renderSettings } from './ui/settings.js';

// First open: load Coach Default.
if (!store.getSplit()) store.setSplit(coachDefault());

const root = document.getElementById('app');
const tabs = document.querySelectorAll('.tabbar a');

const navigate = (hash) => {
  if (location.hash === hash) route();
  else location.hash = hash;
};

function route() {
  const hash = location.hash || '#/today';
  const [, name, param] = hash.match(/^#\/([^/]*)\/?(.*)$/) || [];
  const ctx = { navigate };

  if (name !== 'workout') releaseWakeLock();
  document.body.classList.toggle('no-tabs', name === 'workout');

  const tab = { today: 'today', workout: 'today', summary: 'today', history: 'history', exercise: 'history', split: 'split', settings: 'settings' }[name] || 'today';
  tabs.forEach((a) => {
    const on = a.dataset.tab === tab;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });

  switch (name) {
    case 'workout': renderWorkout(root, ctx); break;
    case 'summary': renderSummary(root, ctx); break;
    case 'history':
      if (param) renderSessionDetail(root, decodeURIComponent(param));
      else renderHistory(root, ctx);
      break;
    case 'exercise': renderExercise(root, decodeURIComponent(param)); break;
    case 'split': renderSplit(root, ctx); break;
    case 'settings': renderSettings(root, ctx); break;
    default: renderToday(root, ctx);
  }
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
route();

// Pull the latest split and weights (and push anything waiting).
// Re-draw Today afterwards so changes Claude made show up.
syncOnOpen().then((result) => {
  if (result === 'synced' && (location.hash === '' || location.hash === '#/today')) route();
});

// Retry when the phone comes back online.
window.addEventListener('online', () => syncOnOpen());

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('Service worker failed', err));
}
