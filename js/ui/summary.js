// Save summary: what got done and which lifts go up next time.

import * as store from '../storage.js';
import { h, formatDate, mount } from './dom.js';

export function renderSummary(root, { navigate }) {
  let info;
  try { info = JSON.parse(sessionStorage.getItem('coach.lastSave')); } catch {}
  const session = info && store.getHistory().find((s) => s.id === info.sessionId);
  if (!session) return navigate('#/today');

  const exercisesDone = session.exercises.filter((e) => e.sets.some((s) => s.done)).length;
  const setsDone = session.exercises.flatMap((e) => e.sets).filter((s) => s.done).length;
  const totalSets = session.exercises.flatMap((e) => e.sets).length;

  let status;
  if (info.synced) status = h('p', { class: 'status-line ok' }, 'Synced to GitHub');
  else if (info.connected) status = h('p', { class: 'status-line', style: 'color:var(--purple)' }, 'Saved on phone, will sync');
  else status = h('p', { class: 'status-line muted' }, 'Saved on this phone');

  mount(root,
    h('div', { class: 'topbar' }, h('span', { class: 'small muted' }, formatDate(session.date))),
    h('h1', {}, `${session.dayName} saved`),
    status,
    h('div', { class: 'card' },
      h('ul', { class: 'preview-list' },
        h('li', {}, h('span', {}, 'Exercises'), h('span', { class: 'num' }, exercisesDone)),
        h('li', {}, h('span', {}, 'Sets'), h('span', { class: 'num' }, `${setsDone} of ${totalSets}`)),
      ),
    ),
    h('h2', {}, 'Up next time'),
    info.readyToIncrease.length
      ? h('div', { class: 'card' }, h('ul', { class: 'preview-list' },
          info.readyToIncrease.map((name) => h('li', {}, h('span', {}, name), h('span', { class: 'pill green' }, '↑ weight')))))
      : h('p', { class: 'muted' }, 'No lifts topped out this time. Same weights next session.'),
    h('div', { class: 'dock' }, h('div', { class: 'dock-inner' },
      h('button', { class: 'btn primary block big', onclick: () => navigate('#/today') }, 'Done'),
      h('a', { class: 'btn block', href: `#/history/${encodeURIComponent(session.id)}` }, 'View session'),
    )),
  );
}
